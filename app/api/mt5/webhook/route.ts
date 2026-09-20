import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { parseMt5ClosedTrades } from "@/lib/mt5/trades";
import { isUsableMt5Token } from "@/lib/mt5/token";
import {
  parseMt5WebhookPayload,
  readMt5WebhookToken,
} from "@/lib/mt5/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, X-Edge-Log-Token, X-Api-Token, X-Webhook-Token",
  "Cache-Control": "no-store",
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

function createAnonClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asResult(value: Json | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "invalid_payload" as const };
  }
  const record = value as Record<string, Json | undefined>;
  return {
    ok: record.ok === true,
    error: typeof record.error === "string" ? record.error : "unauthorized",
    accountId: typeof record.accountId === "string" ? record.accountId : undefined,
    balance: typeof record.balance === "number" ? record.balance : undefined,
    equity: typeof record.equity === "number" ? record.equity : undefined,
    ingested: typeof record.ingested === "number" ? record.ingested : undefined,
    syncedAt: typeof record.syncedAt === "string" ? record.syncedAt : undefined,
  };
}

function isMissingRpc(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("apply_mt5_account_snapshot") ||
    normalized.includes("ingest_mt5_closed_trades")
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export function GET() {
  return json({
    ok: true,
    service: "edge-log-mt5",
    method: "POST",
  });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const token = readMt5WebhookToken(request, body);
  if (!isUsableMt5Token(token)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const snapshot = parseMt5WebhookPayload(body);
  const trades = parseMt5ClosedTrades(body, snapshot.balance);
  if (snapshot.balance == null && trades.length === 0) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }

  const supabase = createAnonClient();
  let accountId: string | undefined;
  let balance = snapshot.balance ?? undefined;
  let equity = snapshot.equity ?? undefined;
  let ingested = 0;
  let syncedAt: string | undefined;

  if (snapshot.balance != null) {
    const { data, error } = await supabase.rpc("apply_mt5_account_snapshot", {
      p_token: token,
      p_login: snapshot.login,
      p_server: snapshot.server,
      p_balance: snapshot.balance,
      p_equity: snapshot.equity,
    });
    if (error) {
      return json(
        { ok: false, error: isMissingRpc(error.message) ? "mt5_not_configured" : "unauthorized" },
        isMissingRpc(error.message) ? 503 : 401
      );
    }
    const result = asResult(data);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error === "invalid_payload" ? 400 : 401);
    }
    accountId = result.accountId;
    balance = result.balance;
    equity = result.equity;
    syncedAt = result.syncedAt;
  }

  if (trades.length > 0) {
    const { data, error } = await supabase.rpc("ingest_mt5_closed_trades", {
      p_token: token,
      p_trades: trades as unknown as Json,
    });
    if (error) {
      return json(
        { ok: false, error: isMissingRpc(error.message) ? "mt5_not_configured" : "unauthorized" },
        isMissingRpc(error.message) ? 503 : 401
      );
    }
    const result = asResult(data);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, 401);
    }
    accountId = result.accountId ?? accountId;
    ingested = result.ingested ?? trades.length;
    syncedAt = result.syncedAt ?? syncedAt;
  }

  return json({
    ok: true,
    accountId,
    balance,
    equity,
    ingested,
    syncedAt,
  });
}
