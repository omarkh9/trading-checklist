import { hasMt5InvestorCredentials } from "@/lib/mt5/credentials";
import {
  getMetaApiToken,
  getMt5GatewaySecret,
  getMt5GatewayUrl,
} from "@/lib/mt5/env";
import { Mt5GatewayError } from "@/lib/mt5/gateway";
import { readMt5GatewayMoney } from "@/lib/mt5/ingest";
import { extractMt5TradeList, readMt5AccountMetrics } from "@/lib/mt5/trades";

export type Mt5HistoryRequest = {
  login?: string;
  investorPassword?: string;
  server?: string;
  connectionId?: string;
  accountId: string;
  userId: string;
  from: Date;
  to: Date;
};

export type Mt5HistorySnapshot = {
  connectionId: string;
  deals: unknown[];
  balance: number | null;
  equity: number | null;
  raw?: unknown;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function pickString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return { message: text.slice(0, 180) };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoStamp(date: Date) {
  return date.toISOString();
}

function gatewayConnectionId(input: Mt5HistoryRequest) {
  const value = input.connectionId?.trim() ?? "";
  return value.startsWith("mt5:") ? "" : value;
}

function snapshotFromBody(
  body: unknown,
  input: Mt5HistoryRequest,
  fallbackConnectionId = ""
): Mt5HistorySnapshot {
  console.log(JSON.stringify(body));
  const record = asRecord(body);
  const money = readMt5GatewayMoney(body);
  return {
    connectionId:
      pickString(record, ["connectionId", "id"]) ||
      fallbackConnectionId ||
      input.connectionId ||
      `mt5:${input.accountId}:${input.login ?? "history"}`,
    deals: extractMt5TradeList(body),
    balance: money.balance,
    equity: money.equity,
    raw: body,
  };
}

async function fetchViaGateway(
  gatewayUrl: string,
  input: Mt5HistoryRequest
): Promise<Mt5HistorySnapshot> {
  const secret = getMt5GatewaySecret();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };

  const knownConnectionId = gatewayConnectionId(input);
  if (knownConnectionId) {
    const url = new URL(
      `${gatewayUrl}/v1/connections/${encodeURIComponent(knownConnectionId)}/history`
    );
    url.searchParams.set("from", isoStamp(input.from));
    url.searchParams.set("to", isoStamp(input.to));
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(25000),
      });
      if (response.ok) {
        return snapshotFromBody(await readJson(response), input, knownConnectionId);
      }
    } catch {
      // Fall through to the credentialed history POST.
    }
  }

  let response: Response;
  try {
    response = await fetch(`${gatewayUrl}/v1/history`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        login: input.login,
        password: input.investorPassword,
        investorPassword: input.investorPassword,
        server: input.server,
        connectionId: input.connectionId,
        accountId: input.accountId,
        userId: input.userId,
        from: isoStamp(input.from),
        to: isoStamp(input.to),
        platform: "mt5",
        readOnly: true,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Mt5GatewayError(
      "Could not reach the MT5 history gateway. Try again in a moment.",
      "unavailable"
    );
  }

  const body = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    throw new Mt5GatewayError(
      "MT5 rejected those credentials. Check the account number, investor password, and server.",
      "invalid_credentials"
    );
  }
  if (!response.ok || body.ok === false) {
    throw new Mt5GatewayError(
      pickString(body, ["error", "message"]) ||
        "The MT5 gateway could not load deal history.",
      response.status >= 500 ? "unavailable" : "rejected"
    );
  }

  return snapshotFromBody(body, input);
}

function clientApiHost(region: string) {
  const clean = region.trim().toLowerCase();
  if (!clean) return "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";
  return `https://mt-client-api-v1.${clean}.agiliumtrade.ai`;
}

async function metaApiAccount(token: string, connectionId: string) {
  const response = await fetch(
    `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${encodeURIComponent(connectionId)}`,
    {
      headers: { "auth-token": token },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!response.ok) return {};
  return readJson(response);
}

async function waitForMetaApiConnection(token: string, connectionId: string) {
  let account = await metaApiAccount(token, connectionId);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = pickString(account, ["state"]).toUpperCase();
    const status = pickString(account, ["connectionStatus"]).toUpperCase();
    if (state === "DEPLOYED" && (status === "CONNECTED" || !status)) {
      return account;
    }
    await sleep(2000);
    account = await metaApiAccount(token, connectionId);
  }
  return account;
}

async function fetchViaMetaApi(
  token: string,
  input: Mt5HistoryRequest
): Promise<Mt5HistorySnapshot> {
  let connectionId = gatewayConnectionId(input);
  if (!connectionId) {
    if (!input.login || !input.investorPassword || !input.server) {
      throw new Mt5GatewayError(
        "Link this MT5 account first, or send the investor login to backfill history.",
        "rejected"
      );
    }
    const created = await fetch(
      "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": token,
        },
        body: JSON.stringify({
          login: input.login,
          password: input.investorPassword,
          name: `Edge Log ${input.login}`,
          server: input.server,
          platform: "mt5",
          magic: 0,
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    const body = await readJson(created);
    if (!created.ok) {
      throw new Mt5GatewayError(
        "MT5 rejected those credentials. Check the account number, investor password, and server.",
        "invalid_credentials"
      );
    }
    connectionId = pickString(body, ["id", "connectionId"]);
    if (!connectionId) {
      throw new Mt5GatewayError(
        "The MT5 gateway did not return a connection id.",
        "unavailable"
      );
    }
  }

  const account = await waitForMetaApiConnection(token, connectionId);
  const host = clientApiHost(pickString(account, ["region"]));
  const headers = { "auth-token": token };
  const start = encodeURIComponent(isoStamp(input.from));
  const end = encodeURIComponent(isoStamp(input.to));

  const [dealsResponse, infoResponse] = await Promise.all([
    fetch(
      `${host}/users/current/accounts/${encodeURIComponent(connectionId)}/history-deals/time/${start}/${end}`,
      { headers, signal: AbortSignal.timeout(25000) }
    ),
    fetch(
      `${host}/users/current/accounts/${encodeURIComponent(connectionId)}/account-information`,
      { headers, signal: AbortSignal.timeout(15000) }
    ),
  ]);

  if (dealsResponse.status === 401 || dealsResponse.status === 403) {
    throw new Mt5GatewayError(
      "MT5 rejected those credentials. Check the account number, investor password, and server.",
      "invalid_credentials"
    );
  }
  if (!dealsResponse.ok) {
    throw new Mt5GatewayError(
      "Could not load MT5 deal history. Confirm the investor login and try again.",
      dealsResponse.status >= 500 ? "unavailable" : "rejected"
    );
  }

  const dealsBody = await dealsResponse.json().catch(() => []);
  const infoBody = infoResponse.ok ? await readJson(infoResponse) : {};
  const deals = Array.isArray(dealsBody)
    ? dealsBody
    : extractMt5TradeList(dealsBody);
  const metrics = readMt5AccountMetrics({
    ...infoBody,
    deals,
    account: infoBody,
  });

  const gatewayMoney = readMt5GatewayMoney(infoBody);
  return {
    connectionId,
    deals,
    balance: gatewayMoney.balance ?? metrics.balance,
    equity: gatewayMoney.equity ?? metrics.equity,
    raw: infoBody,
  };
}

function investorHistoryEndpoints(server: string) {
  const value = server.trim();
  if (!value) return [];

  if (/^https?:\/\//i.test(value)) {
    return [value.replace(/\/$/, "")];
  }

  if (/^[a-z0-9.-]+:\d+$/i.test(value)) {
    return [`https://${value}`, `http://${value}`];
  }

  if (value.includes(".")) {
    return [`https://${value.replace(/\/$/, "")}`, `http://${value.replace(/\/$/, "")}`];
  }

  return [];
}

const MT5_LIVE_SYNC_UNAVAILABLE =
  "Live MT5 sync is not available right now. Your saved balance was not changed.";

async function fetchViaInvestorCredentials(
  input: Mt5HistoryRequest
): Promise<Mt5HistorySnapshot> {
  if (!hasMt5InvestorCredentials(input)) {
    throw new Mt5GatewayError(
      "This account is missing a saved investor login. Reconnect MT5 from the journal.",
      "rejected"
    );
  }

  const endpoints = investorHistoryEndpoints(input.server ?? "");
  let lastError: Mt5GatewayError | null = null;
  for (const endpoint of endpoints) {
    try {
      return await fetchViaGateway(endpoint, input);
    } catch (cause) {
      if (cause instanceof Mt5GatewayError && cause.code === "invalid_credentials") {
        throw cause;
      }
      lastError = cause instanceof Mt5GatewayError ? cause : lastError;
    }
  }

  throw lastError ?? new Mt5GatewayError(MT5_LIVE_SYNC_UNAVAILABLE, "unavailable");
}

export async function fetchMt5History(
  input: Mt5HistoryRequest
): Promise<Mt5HistorySnapshot> {
  const hasCredentials = hasMt5InvestorCredentials(input);
  if (!hasCredentials && !input.connectionId?.trim()) {
    throw new Mt5GatewayError(
      "This account is missing a saved investor login. Reconnect MT5 from the journal.",
      "rejected"
    );
  }

  let lastError: Mt5GatewayError | null = null;

  const gatewayUrl = getMt5GatewayUrl();
  if (gatewayUrl) {
    try {
      return await fetchViaGateway(gatewayUrl, input);
    } catch (cause) {
      if (!hasCredentials) throw cause;
      if (cause instanceof Mt5GatewayError && cause.code === "invalid_credentials") {
        throw cause;
      }
      lastError = cause instanceof Mt5GatewayError ? cause : lastError;
    }
  }

  const token = getMetaApiToken();
  if (token) {
    try {
      return await fetchViaMetaApi(token, input);
    } catch (cause) {
      if (!hasCredentials) throw cause;
      if (cause instanceof Mt5GatewayError && cause.code === "invalid_credentials") {
        throw cause;
      }
      lastError = cause instanceof Mt5GatewayError ? cause : lastError;
    }
  }

  if (hasCredentials && investorHistoryEndpoints(input.server ?? "").length > 0) {
    return fetchViaInvestorCredentials(input);
  }

  if (lastError) throw lastError;

  console.error(
    "MT5 live sync has no broker gateway. Set MT5_GATEWAY_URL or METAAPI_TOKEN on the server."
  );
  throw new Mt5GatewayError(MT5_LIVE_SYNC_UNAVAILABLE, "unavailable");
}
