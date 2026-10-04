import { NextResponse } from "next/server";
import { pickIdleConnections } from "@/lib/mt5/activity";
import { getMetaApiToken, getMt5SyncSecret } from "@/lib/mt5/env";
import { undeployMetaApiAccount } from "@/lib/mt5/metaapi";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Called hourly by netlify/functions/mt5-idle.mjs. Pauses (undeploys) MetaAPI
// accounts nobody has used for 6 hours; the next sync from the app deploys
// them again. MetaAPI only bills while an account is deployed.
export async function POST(request: Request) {
  const secret = getMt5SyncSecret();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth.replace(/^bearer\s+/i, "").trim() !== secret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const token = getMetaApiToken();
  if (!token) return json({ ok: true, skipped: "METAAPI_TOKEN is not set." });

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return json(
      { ok: false, error: "The idle job needs SUPABASE_SERVICE_ROLE_KEY." },
      503
    );
  }

  const { data, error } = await supabase
    .from("trading_accounts")
    .select("mt5_connection_id, mt5_active_at, mt5_synced_at")
    .not("mt5_connection_id", "is", null);
  if (error) {
    // Without mt5_active_at there is no safe way to tell who is active.
    console.error("MT5 idle check could not read accounts", error);
    return json(
      {
        ok: false,
        error: error.message.includes("mt5_active_at")
          ? "Run supabase/mt5-activity.sql to enable idle pausing."
          : error.message,
      },
      503
    );
  }

  const idle = pickIdleConnections(data ?? []);
  const paused: string[] = [];
  const failed: string[] = [];
  for (const id of idle) {
    try {
      if (await undeployMetaApiAccount(token, id)) paused.push(id);
    } catch (cause) {
      failed.push(id);
      console.error("MT5 idle pause failed", {
        connectionId: id,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  console.info("MT5 idle check", {
    linked: data?.length ?? 0,
    idle: idle.length,
    paused,
    failed,
  });
  return json({ ok: true, idle: idle.length, paused, failed });
}
