import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// MetaAPI bills a minimum of 6 hours every time an account starts, so pausing
// one sooner saves nothing.
export const MT5_IDLE_MS = 6 * 60 * 60 * 1000;

// Stamps a sync attempt so the idle job keeps this account's MetaAPI server
// running while the user is around. Databases without mt5_active_at (before
// supabase/mt5-activity.sql) just skip it; the idle job then pauses nothing.
export async function markMt5Active(
  supabase: SupabaseClient<Database>,
  accountId: string,
  userId: string
) {
  const { error } = await supabase
    .from("trading_accounts")
    .update({ mt5_active_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", userId);
  if (error) {
    console.warn("Could not record MT5 activity", {
      accountId,
      message: error.message,
    });
  }
}

type ActivityRow = {
  mt5_connection_id: string | null;
  mt5_active_at?: string | null;
  mt5_synced_at?: string | null;
};

// MetaAPI accounts with no activity or sync for MT5_IDLE_MS. Several journal
// accounts can share one MetaAPI account (same MT5 login), so it stays on
// while any of them is active.
export function pickIdleConnections(rows: ActivityRow[], now = Date.now()) {
  const lastSeen = new Map<string, number>();
  for (const row of rows) {
    const id = row.mt5_connection_id?.trim() ?? "";
    if (!id || id.startsWith("mt5:")) continue;
    const seen = Math.max(
      Date.parse(row.mt5_active_at ?? "") || 0,
      Date.parse(row.mt5_synced_at ?? "") || 0
    );
    lastSeen.set(id, Math.max(lastSeen.get(id) ?? 0, seen));
  }
  return [...lastSeen]
    .filter(([, seen]) => now - seen >= MT5_IDLE_MS)
    .map(([id]) => id);
}
