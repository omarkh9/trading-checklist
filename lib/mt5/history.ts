import { hasMt5InvestorCredentials } from "@/lib/mt5/credentials";
import {
  getMetaApiToken,
  getMt5GatewayHeaders,
  getMt5GatewayUrl,
} from "@/lib/mt5/env";
import { Mt5GatewayError } from "@/lib/mt5/gateway";
import { readMt5GatewayMoney } from "@/lib/mt5/ingest";
import { fetchMetaApiHistory } from "@/lib/mt5/metaapi";
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
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...getMt5GatewayHeaders(),
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
  } catch (cause) {
    console.error("MT5 bridge request failed before a response:", {
      url: `${gatewayUrl}/v1/history`,
      accountId: input.accountId,
      server: input.server,
      error: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
      cause: cause instanceof Error ? cause.cause : undefined,
    });
    throw new Mt5GatewayError(
      "Could not reach the MT5 history gateway. Try again in a moment.",
      "unavailable"
    );
  }

  const body = await readJson(response);
  if (!response.ok || body.ok === false) {
    console.error("MT5 bridge returned an error response:", {
      url: `${gatewayUrl}/v1/history`,
      accountId: input.accountId,
      server: input.server,
      status: response.status,
      statusText: response.statusText,
      body,
    });
  }
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
      return await fetchMetaApiHistory(token, input);
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
