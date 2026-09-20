import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
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

function snapshotResult(value: Json | null) {
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
    syncedAt: typeof record.syncedAt === "string" ? record.syncedAt : undefined,
  };
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

  const payload = parseMt5WebhookPayload(body);
  if (payload.balance == null) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("apply_mt5_account_snapshot", {
    p_token: token,
    p_login: payload.login,
    p_server: payload.server,
    p_balance: payload.balance,
    p_equity: payload.equity,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("apply_mt5_account_snapshot") ||
      message.includes("schema cache") ||
      message.includes("does not exist")
    ) {
      return json({ ok: false, error: "mt5_not_configured" }, 503);
    }
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const result = snapshotResult(data);
  if (!result.ok) {
    const status = result.error === "invalid_payload" ? 400 : 401;
    return json({ ok: false, error: result.error }, status);
  }

  return json({
    ok: true,
    accountId: result.accountId,
    balance: result.balance,
    equity: result.equity,
    syncedAt: result.syncedAt,
  });
}
