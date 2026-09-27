import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateMt5LinkInput } from "@/lib/mt5/credentials";
import { Mt5GatewayError } from "@/lib/mt5/gateway";
import { canFetchMt5History, getMt5SyncSecret, getSupabaseServiceRoleKey } from "@/lib/mt5/env";
import { loadMt5StoredCredentials } from "@/lib/mt5/stored-credentials";
import { syncMt5Journal } from "@/lib/mt5/sync";
import { readMt5AccountMetrics } from "@/lib/mt5/trades";
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

  const requestedAccountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
  const days = typeof body.days === "number" ? body.days : undefined;
  const syncAll = worker && body.all === true;

  if (!requestedAccountId && !syncAll) {
    return json({ ok: false, error: "accountId is required." }, 400);
  }

  if (worker && (body.investorPassword || body.password)) {
    return json(
      { ok: false, error: "Worker sync uses stored investor passwords only." },
      400
    );
  }

  let requestCredentials:
    | { login: string; investorPassword: string; server: string }
    | null = null;
  if (
    !worker &&
    (typeof body.login === "string" ||
      typeof body.investorPassword === "string" ||
      typeof body.password === "string" ||
      typeof body.server === "string")
  ) {
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
    requestCredentials = parsed;
  }

  const reader = createServiceClient() ?? supabase;
  let targets;
  try {
    targets = await loadMt5StoredCredentials(reader, {
      userId: worker ? undefined : userId,
      accountId: requestedAccountId || undefined,
    });
  } catch (cause) {
    return json(
      {
        ok: false,
        error:
          cause instanceof Error
            ? cause.message
            : "Could not read saved MT5 credentials.",
      },
      400
    );
  }

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
    const useRequestCredentials =
      Boolean(requestCredentials) && account.id === requestedAccountId;
    const login =
      (useRequestCredentials ? requestCredentials?.login : "") ||
      account.login ||
      "";
    const server =
      (useRequestCredentials ? requestCredentials?.server : "") ||
      account.server ||
      "";
    const investorPassword =
      (useRequestCredentials ? requestCredentials?.investorPassword : "") ||
      account.investorPassword;

    if (!login || !server || !investorPassword) {
      const message =
        "This account is missing a saved investor login. Reconnect MT5 from the journal.";
      if (!syncAll && targets.length === 1) {
        return json({ ok: false, error: message }, 422);
      }
      results.push({ ok: false, accountId: account.id, error: message });
      continue;
    }

    try {
      const result = await syncMt5Journal({
        supabase,
        userId: worker ? account.userId : userId,
        accountId: account.id,
        login,
        investorPassword,
        server,
        connectionId: account.connectionId ?? undefined,
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
      console.error("MT5 sync failed:", {
        accountId: account.id,
        server,
        status,
        code: cause instanceof Mt5GatewayError ? cause.code : "unexpected",
        message: cause instanceof Error ? cause.message : String(cause),
        stack: cause instanceof Error ? cause.stack : undefined,
      });
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

  const primary = results[0] ?? {};
  const metrics = readMt5AccountMetrics(primary);
  const balance = metrics.balance;
  const equity = metrics.equity;

  return json({
    ok: true,
    ingested,
    accounts: results.length,
    results,
    accountId: primary.accountId ?? requestedAccountId,
    balance,
    equity,
    mt5_balance: balance,
    mt5_equity: equity,
    mt5Balance: balance,
    mt5Equity: equity,
    syncedAt: primary.syncedAt ?? null,
    connectionId: primary.connectionId ?? null,
    scanned: primary.scanned ?? 0,
  });
}
