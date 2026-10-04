import { createHash } from "crypto";
import { Mt5GatewayError } from "@/lib/mt5/errors";

const PROVISIONING_API =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
// Accounts this app adds carry this name prefix. The app only deploys or
// removes accounts it created, never other MetaAPI accounts on the same token.
const ACCOUNT_NAME_PREFIX = "Edge Log ";
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_ATTEMPTS = 2;
const DEALS_PAGE_SIZE = 1000;
const MAX_DEAL_PAGES = 20;
const TRADE_TYPES = new Set(["DEAL_TYPE_BUY", "DEAL_TYPE_SELL"]);
const CLOSING_ENTRIES = new Set([
  "DEAL_ENTRY_OUT",
  "DEAL_ENTRY_INOUT",
  "DEAL_ENTRY_OUT_BY",
]);

type JsonRecord = Record<string, unknown>;

export type MetaApiAccountInput = {
  login?: string;
  investorPassword?: string;
  server?: string;
  connectionId?: string;
  accountId: string;
  userId: string;
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 180) };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MetaApiResponse = { status: number; ok: boolean; body: unknown };

// On Netlify a pooled connection can go dead while the function is frozen
// between requests, and a request sent on it hangs with no reply. Abort after
// a short timeout (which discards that connection) and retry on a fresh one.
// Every MetaAPI call here is safe to repeat; account creation is keyed by its
// transaction-id.
async function metaApiFetch(
  url: string | URL,
  token: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<MetaApiResponse> {
  let result: MetaApiResponse | null = null;
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS && !result; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: init.method ?? "GET",
        headers: { ...init.headers, "auth-token": token },
        body: init.body,
        signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
      });
      result = {
        status: response.status,
        ok: response.ok,
        body: await readJson(response),
      };
      if (attempt > 1) {
        console.info("MetaAPI request recovered on retry", {
          path: new URL(String(url)).pathname,
          attempt,
          ms: Date.now() - started,
        });
      }
    } catch (cause) {
      console.warn("MetaAPI request failed", {
        path: new URL(String(url)).pathname,
        attempt,
        ms: Date.now() - started,
        error: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
      });
    }
  }
  if (!result) {
    throw new Mt5GatewayError(
      "Could not reach MetaAPI. Try again in a moment.",
      "unavailable"
    );
  }
  // 401 is the server's token; 403 is also used for account problems such as
  // "please top up your account", so that one keeps MetaAPI's own message.
  if (result.status === 401) {
    throw new Mt5GatewayError(
      "MetaAPI rejected the server's METAAPI_TOKEN. Update it in the Netlify environment variables.",
      "unavailable"
    );
  }
  return result;
}

const STILL_CONNECTING =
  "MetaAPI is still connecting this account to your broker. Trades will sync automatically in a few minutes.";

function failure(response: MetaApiResponse, fallback: string) {
  const body = asRecord(response.body);
  const message = asText(body.message).replace(/\s*\([0-9a-f]{32}\)$/i, "");
  if (/not connected to broker yet/i.test(message)) {
    return new Mt5GatewayError(STILL_CONNECTING, "unavailable");
  }
  return new Mt5GatewayError(
    message || fallback,
    response.status >= 500 || response.status === 403 ? "unavailable" : "rejected"
  );
}

function accountIdOf(record: JsonRecord) {
  return asText(record._id) || asText(record.id);
}

function accountUrl(id: string, suffix = "") {
  return `${PROVISIONING_API}/users/current/accounts/${encodeURIComponent(id)}${suffix}`;
}

async function readAccount(token: string, id: string) {
  const response = await metaApiFetch(accountUrl(id), token);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    throw failure(response, "Could not read the MetaAPI account.");
  }
  const record = asRecord(response.body);
  return accountIdOf(record) ? record : null;
}

async function findAccount(token: string, login: string, server: string) {
  const url = new URL(`${PROVISIONING_API}/users/current/accounts`);
  url.searchParams.set("query", login);
  const response = await metaApiFetch(url, token);
  if (!response.ok) {
    throw failure(response, "Could not read MetaAPI accounts.");
  }
  const body = response.body;
  const list = Array.isArray(body) ? body : asRecord(body).items;
  if (!Array.isArray(list)) return null;
  return (
    list
      .map(asRecord)
      .find(
        (account) =>
          accountIdOf(account) &&
          asText(account.login) === login &&
          asText(account.server).toLowerCase() === server.toLowerCase()
      ) ?? null
  );
}

// MetaAPI finishes a 202 ("broker settings detection in progress") when the
// same transaction-id is sent again, so derive it from the link rather than
// randomising it. The day stops a later re-link replaying an old result.
function transactionId(input: MetaApiAccountInput) {
  return createHash("sha256")
    .update(
      [
        input.userId,
        input.accountId,
        input.login,
        input.server,
        new Date().toISOString().slice(0, 10),
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);
}

async function createAccount(
  token: string,
  input: MetaApiAccountInput & {
    login: string;
    investorPassword: string;
    server: string;
  }
) {
  const response = await metaApiFetch(
    `${PROVISIONING_API}/users/current/accounts`,
    token,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "transaction-id": transactionId(input),
      },
      body: JSON.stringify({
        login: input.login,
        password: input.investorPassword,
        name: `${ACCOUNT_NAME_PREFIX}${input.login}`,
        server: input.server,
        platform: "mt5",
        magic: 0,
      }),
      timeoutMs: 15000,
    }
  );
  if (response.status === 202) return "";
  if (!response.ok) {
    throw failure(
      response,
      "MetaAPI could not add this MT5 account. Check the account number, investor password, and server."
    );
  }
  const id = accountIdOf(asRecord(response.body));
  if (!id) {
    throw new Mt5GatewayError(
      "MetaAPI did not return an account id.",
      "unavailable"
    );
  }
  return id;
}

// Reuse the account saved on the journal, then any MetaAPI account with the
// same login and server, and only then add a new one (billed per account).
// An empty id means MetaAPI accepted the request but is still setting it up.
export async function ensureMetaApiAccount(
  token: string,
  input: MetaApiAccountInput
): Promise<{ id: string; account: JsonRecord | null }> {
  const known = input.connectionId?.trim() ?? "";
  if (known) {
    const account = await readAccount(token, known);
    if (account) return { id: accountIdOf(account), account };
  }

  const login = input.login?.trim() ?? "";
  const server = input.server?.trim() ?? "";
  const investorPassword = input.investorPassword?.trim() ?? "";
  if (!login || !server) {
    throw new Mt5GatewayError(
      "This account is missing a saved investor login. Reconnect MT5 from the journal.",
      "rejected"
    );
  }

  const found = await findAccount(token, login, server);
  if (found) return { id: accountIdOf(found), account: found };

  if (!investorPassword) {
    throw new Mt5GatewayError(
      "This account is missing a saved investor login. Reconnect MT5 from the journal.",
      "rejected"
    );
  }
  const id = await createAccount(token, {
    ...input,
    login,
    server,
    investorPassword,
  });
  return { id, account: null };
}

async function deployAccount(token: string, id: string, account: JsonRecord) {
  if (!asText(account.name).startsWith(ACCOUNT_NAME_PREFIX)) {
    throw new Mt5GatewayError(
      "This MT5 account is paused in MetaAPI. Deploy it in MetaAPI to sync.",
      "unavailable"
    );
  }
  const response = await metaApiFetch(accountUrl(id, "/deploy"), token, {
    method: "POST",
  });
  if (!response.ok) {
    throw failure(response, "MetaAPI could not start this MT5 account.");
  }
}

async function waitForConnection(
  token: string,
  id: string,
  account: JsonRecord | null
) {
  let current = account ?? (await readAccount(token, id)) ?? {};
  if (asText(current.state).toUpperCase() === "UNDEPLOYED") {
    await deployAccount(token, id, current);
    current = (await readAccount(token, id)) ?? current;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = asText(current.state).toUpperCase();
    const status = asText(current.connectionStatus).toUpperCase();
    if (state === "DEPLOYED" && (status === "CONNECTED" || !status)) {
      return current;
    }
    await sleep(2000);
    current = (await readAccount(token, id)) ?? current;
  }
  return current;
}

function clientApiHost(region: string) {
  const clean = region.trim().toLowerCase();
  if (!clean) return "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";
  return `https://mt-client-api-v1.${clean}.agiliumtrade.ai`;
}

async function readDeals(
  token: string,
  host: string,
  id: string,
  from: Date,
  to: Date
) {
  const base = `${host}/users/current/accounts/${encodeURIComponent(id)}/history-deals/time/${encodeURIComponent(from.toISOString())}/${encodeURIComponent(to.toISOString())}`;
  const deals: unknown[] = [];
  for (let page = 0; page < MAX_DEAL_PAGES; page += 1) {
    const url = new URL(base);
    url.searchParams.set("offset", String(page * DEALS_PAGE_SIZE));
    url.searchParams.set("limit", String(DEALS_PAGE_SIZE));
    const pageStarted = Date.now();
    const response = await metaApiFetch(url, token);
    if (response.status === 404) {
      throw new Mt5GatewayError(STILL_CONNECTING, "unavailable");
    }
    if (!response.ok) {
      throw failure(
        response,
        "Could not load MT5 deal history from MetaAPI. Try again in a moment."
      );
    }
    const body = response.body;
    const batch = Array.isArray(body) ? body : [];
    deals.push(...batch);
    console.info("MetaAPI deals page", {
      page,
      received: batch.length,
      firstId: asText(asRecord(batch[0]).id),
      ms: Date.now() - pageStarted,
    });
    if (batch.length < DEALS_PAGE_SIZE) break;
  }
  return deals;
}

async function readAccountInformation(token: string, host: string, id: string) {
  const response = await metaApiFetch(
    `${host}/users/current/accounts/${encodeURIComponent(id)}/account-information`,
    token
  );
  return response.ok ? asRecord(response.body) : {};
}

// Turns MetaAPI deals into the MT5 bridge's closed-trade rows, so
// parseMt5ClosedTrades reads both sources the same way.
export function closedTradesFromMetaApiDeals(deals: unknown[]) {
  const records = deals.map(asRecord);
  const openings = new Map<string, JsonRecord>();
  for (const deal of records) {
    const position = asText(deal.positionId);
    if (
      position &&
      TRADE_TYPES.has(asText(deal.type)) &&
      asText(deal.entryType) === "DEAL_ENTRY_IN" &&
      !openings.has(position)
    ) {
      openings.set(position, deal);
    }
  }

  return records.flatMap((deal) => {
    if (
      !TRADE_TYPES.has(asText(deal.type)) ||
      !CLOSING_ENTRIES.has(asText(deal.entryType))
    ) {
      return [];
    }
    const position = asText(deal.positionId) || asText(deal.id);
    const opening = openings.get(position);
    return [
      {
        positionId: position,
        ticket: asText(deal.id),
        symbol: asText(deal.symbol),
        // A closing SELL deal closes a long position, and vice versa.
        direction: asText(deal.type) === "DEAL_TYPE_SELL" ? "Long" : "Short",
        entry: "out",
        openPrice: asText(opening?.price) || asText(deal.price),
        closePrice: asText(deal.price),
        sl: asText(deal.stopLoss) || asText(opening?.stopLoss),
        tp: asText(deal.takeProfit) || asText(opening?.takeProfit),
        volume: asText(deal.volume),
        profit: asNumber(deal.profit) ?? 0,
        commission: asNumber(deal.commission) ?? 0,
        swap: asNumber(deal.swap) ?? 0,
        openTime: asText(opening?.time) || null,
        closeTime: asText(deal.time),
      },
    ];
  });
}

export async function fetchMetaApiHistory(
  token: string,
  input: MetaApiAccountInput & { from: Date; to: Date }
) {
  const started = Date.now();
  const ensured = await ensureMetaApiAccount(token, input);
  if (!ensured.id) {
    throw new Mt5GatewayError(
      "MetaAPI is still adding this MT5 account. It will sync automatically in a few minutes.",
      "unavailable"
    );
  }

  const account = await waitForConnection(token, ensured.id, ensured.account);
  console.info("MetaAPI account ready", {
    state: asText(account.state),
    connection: asText(account.connectionStatus),
    region: asText(account.region),
    ms: Date.now() - started,
  });
  // A new account needs a minute or two to log in to the broker; until then
  // MetaAPI answers history requests with a confusing region/URL error.
  const connection = asText(account.connectionStatus).toUpperCase();
  if (connection && connection !== "CONNECTED") {
    throw new Mt5GatewayError(
      connection === "DISCONNECTED_FROM_BROKER"
        ? "MetaAPI can't log in to your broker yet. If this keeps happening, check the investor password and server, then reconnect."
        : STILL_CONNECTING,
      "unavailable"
    );
  }
  const host = clientApiHost(asText(account.region));
  const [deals, info] = await Promise.all([
    readDeals(token, host, ensured.id, input.from, input.to),
    readAccountInformation(token, host, ensured.id),
  ]);

  const balance = asNumber(info.balance);
  return {
    connectionId: ensured.id,
    deals: closedTradesFromMetaApiDeals(deals),
    balance,
    equity: asNumber(info.equity) ?? balance,
    raw: info,
  };
}

// Stops billing for an idle account the app created. The next sync deploys it
// again (another 6-hour minimum), so only the idle job calls this.
export async function undeployMetaApiAccount(token: string, id: string) {
  const account = await readAccount(token, id);
  if (
    !account ||
    !asText(account.name).startsWith(ACCOUNT_NAME_PREFIX) ||
    asText(account.state).toUpperCase() !== "DEPLOYED"
  ) {
    return false;
  }
  const response = await metaApiFetch(accountUrl(id, "/undeploy"), token, {
    method: "POST",
  });
  if (!response.ok) {
    throw failure(response, "MetaAPI could not pause this MT5 account.");
  }
  return true;
}

export async function removeMetaApiAccount(token: string, id: string) {
  const account = await readAccount(token, id);
  if (!account || !asText(account.name).startsWith(ACCOUNT_NAME_PREFIX)) return;
  await metaApiFetch(accountUrl(id), token, { method: "DELETE" });
}
