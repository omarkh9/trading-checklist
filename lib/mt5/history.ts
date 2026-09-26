import {
  getMetaApiToken,
  getMt5GatewaySecret,
  getMt5GatewayUrl,
} from "@/lib/mt5/env";
import { Mt5GatewayError } from "@/lib/mt5/gateway";
import { extractMt5TradeList } from "@/lib/mt5/trades";

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

function pickNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
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

async function fetchViaGateway(
  gatewayUrl: string,
  input: Mt5HistoryRequest
): Promise<Mt5HistorySnapshot> {
  const secret = getMt5GatewaySecret();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };

  if (input.connectionId) {
    const url = new URL(
      `${gatewayUrl}/v1/connections/${encodeURIComponent(input.connectionId)}/history`
    );
    url.searchParams.set("from", isoStamp(input.from));
    url.searchParams.set("to", isoStamp(input.to));
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(25000),
      });
      if (response.ok) {
        const body = await readJson(response);
        return {
          connectionId:
            pickString(body, ["connectionId", "id"]) || input.connectionId,
          deals: extractMt5TradeList(body),
          balance: pickNumber(body, ["balance"]),
          equity: pickNumber(body, ["equity"]),
        };
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

  return {
    connectionId:
      pickString(body, ["connectionId", "id"]) ||
      input.connectionId ||
      `mt5:${input.accountId}:${input.login ?? "history"}`,
    deals: extractMt5TradeList(body),
    balance: pickNumber(body, ["balance"]),
    equity: pickNumber(body, ["equity"]),
  };
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
  let connectionId = input.connectionId?.trim() ?? "";
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

  return {
    connectionId,
    deals,
    balance: pickNumber(infoBody, ["balance"]),
    equity: pickNumber(infoBody, ["equity"]),
  };
}

export async function fetchMt5History(
  input: Mt5HistoryRequest
): Promise<Mt5HistorySnapshot> {
  const gatewayUrl = getMt5GatewayUrl();
  if (gatewayUrl) return fetchViaGateway(gatewayUrl, input);

  const token = getMetaApiToken();
  if (token) return fetchViaMetaApi(token, input);

  throw new Mt5GatewayError(
    "MT5 history sync needs METAAPI_TOKEN or MT5_GATEWAY_URL on the server.",
    "unavailable"
  );
}
