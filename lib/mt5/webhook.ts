import { SITE_URL } from "@/lib/site";
import { MT5_WEBHOOK_PATH } from "@/lib/mt5/token";

export function getMt5WebhookUrl() {
  return `${SITE_URL}${MT5_WEBHOOK_PATH}`;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function pickString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function readMt5WebhookToken(request: Request, body: unknown) {
  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const token = auth.replace(/^bearer\s+/i, "").trim();
    if (token) return token;
  }

  const header =
    request.headers.get("x-edge-log-token")?.trim() ||
    request.headers.get("x-api-token")?.trim() ||
    request.headers.get("x-webhook-token")?.trim();
  if (header) return header;

  return pickString(asRecord(body), ["token", "apiToken", "webhookToken"]);
}

export function parseMt5WebhookPayload(body: unknown) {
  const record = asRecord(body);
  const nested = asRecord(record.data);

  return {
    login: pickString({ ...nested, ...record }, [
      "login",
      "account",
      "accountNumber",
      "account_number",
      "mt5Login",
      "mt5_login",
    ]),
    server: pickString({ ...nested, ...record }, [
      "server",
      "broker",
      "brokerServer",
      "broker_server",
      "mt5Server",
      "mt5_server",
    ]),
    balance: pickNumber({ ...nested, ...record }, [
      "balance",
      "accountBalance",
      "account_balance",
      "mt5Balance",
      "mt5_balance",
    ]),
    equity: pickNumber({ ...nested, ...record }, [
      "equity",
      "accountEquity",
      "account_equity",
      "mt5Equity",
      "mt5_equity",
    ]),
  };
}
