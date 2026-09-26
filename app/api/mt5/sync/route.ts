import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateMt5LinkInput } from "@/lib/mt5/credentials";
import { Mt5GatewayError } from "@/lib/mt5/gateway";
import { canFetchMt5History, getMt5SyncSecret, getSupabaseServiceRoleKey } from "@/lib/mt5/env";
import { syncMt5Journal } from "@/lib/mt5/sync";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function readBearer(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, "").trim();
  }
  return (
    request.headers.get("x-edge-log-token")?.trim() ||
    request.headers.get("x-mt5-sync-secret")?.trim() ||
    ""
  );
}

function isWorkerRequest(request: Request) {
  const secret = getMt5SyncSecret();
  const token = readBearer(request);
  return Boolean(secret && token && token === secret);
}

function createServiceClient() {
  const key = getSupabaseServiceRoleKey();
  if (!key) return null;
  return createSupabaseJs<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function GET() {
  return json({
    ok: true,
    service: "edge-log-mt5-sync",
    method: "POST",
    historyEnabled: canFetchMt5History(),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    body = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const worker = isWorkerRequest(request);
  const supabase = worker ? createServiceClient() : await createClient();
  if (!supabase) {
    return json(
      {
        ok: false,
        error: worker
          ? "MT5 worker sync needs SUPABASE_SERVICE_ROLE_KEY on the server."
          : "unauthorized",
      },
      worker ? 503 : 401
    );
  }

  let userId = "";
  if (!worker) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ ok: false, error: "unauthorized" }, 401);
    userId = user.id;
  }

  if (!canFetchMt5History()) {
    return json(
      {
        ok: false,
        error:
          "MT5 history sync needs METAAPI_TOKEN or MT5_GATEWAY_URL on the server.",
      },
      503
    );
  }

  const requestedAccountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
  const days = typeof body.days === "number" ? body.days : undefined;
  const syncAll = worker && body.all === true;

  let credentials:
    | { login: string; investorPassword: string; server: string }
    | null = null;
  if (
    typeof body.login === "string" ||
    typeof body.investorPassword === "string" ||
    typeof body.password === "string" ||
    typeof body.server === "string"
  ) {
    if (worker) {
      return json(
        { ok: false, error: "Worker sync cannot accept investor passwords." },
        400
      );
    }
    const parsed = validateMt5LinkInput({
      login: typeof body.login === "string" ? body.login : "",
      investorPassword:
        typeof body.investorPassword === "string"
          ? body.investorPassword
          : typeof body.password === "string"
            ? body.password
            : "",
      server: typeof body.server === "string" ? body.server : "",
    });
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    credentials = parsed;
  }

  let query = supabase
    .from("trading_accounts")
    .select("id, user_id, mt5_login, mt5_server, mt5_connection_id");
  if (!worker) query = query.eq("user_id", userId);
  if (requestedAccountId) query = query.eq("id", requestedAccountId);
  if (syncAll || !requestedAccountId) {
    query = query.not("mt5_connection_id", "is", null);
  }

  const { data: accounts, error: accountError } = await query;
  if (accountError) {
    return json({ ok: false, error: accountError.message }, 400);
  }

  const targets = accounts ?? [];
  if (targets.length === 0) {
    return json(
      {
        ok: false,
        error: requestedAccountId
          ? "Trading account not found."
          : "No linked MT5 accounts to sync.",
      },
      404
    );
  }

  const results: Record<string, unknown>[] = [];
  for (const account of targets) {
    try {
      const result = await syncMt5Journal({
        supabase,
        userId: worker ? account.user_id : userId,
        accountId: account.id,
        login: credentials?.login ?? account.mt5_login ?? undefined,
        investorPassword: credentials?.investorPassword,
        server: credentials?.server ?? account.mt5_server ?? undefined,
        connectionId: account.mt5_connection_id ?? undefined,
        days,
      });
      results.push(result);
    } catch (cause) {
      const message =
        cause instanceof Mt5GatewayError
          ? cause.message
          : "Could not sync MT5 deal history.";
      const status =
        cause instanceof Mt5GatewayError && cause.code === "unavailable"
          ? 503
          : 422;
      if (!syncAll && targets.length === 1) {
        return json({ ok: false, error: message }, status);
      }
      results.push({ ok: false, accountId: account.id, error: message });
    }
  }

  const ingested = results.reduce(
    (sum, row) => sum + (typeof row.ingested === "number" ? row.ingested : 0),
    0
  );

  return json({
    ok: true,
    ingested,
    accounts: results.length,
    results,
  });
}
