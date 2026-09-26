import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchMt5History } from "@/lib/mt5/history";
import { markMt5Synced, mt5TradesToInserts, upsertMt5Trades } from "@/lib/mt5/ingest";
import { parseMt5ClosedTrades } from "@/lib/mt5/trades";

export const MT5_HISTORY_MAX_DAYS = 1095;
export const MT5_HISTORY_DEFAULT_DAYS = 365;

export function resolveHistoryWindow(days?: number) {
  const span = Math.min(
    MT5_HISTORY_MAX_DAYS,
    Math.max(1, Math.round(days ?? MT5_HISTORY_DEFAULT_DAYS))
  );
  const to = new Date();
  const from = new Date(to.getTime() - span * 24 * 60 * 60 * 1000);
  return { from, to, days: span };
}

export async function syncMt5Journal(options: {
  supabase: SupabaseClient<Database>;
  userId: string;
  accountId: string;
  login?: string;
  investorPassword?: string;
  server?: string;
  connectionId?: string;
  days?: number;
}) {
  const window = resolveHistoryWindow(options.days);
  const snapshot = await fetchMt5History({
    login: options.login,
    investorPassword: options.investorPassword,
    server: options.server,
    connectionId: options.connectionId,
    accountId: options.accountId,
    userId: options.userId,
    from: window.from,
    to: window.to,
  });

  const trades = parseMt5ClosedTrades(
    { deals: snapshot.deals },
    snapshot.balance
  );
  const ingested = await upsertMt5Trades(
    options.supabase,
    mt5TradesToInserts(trades, options.userId, options.accountId)
  );

  await markMt5Synced(options.supabase, {
    accountId: options.accountId,
    userId: options.userId,
    balance: snapshot.balance,
    equity: snapshot.equity,
    connectionId: snapshot.connectionId,
  });

  return {
    ok: true as const,
    accountId: options.accountId,
    connectionId: snapshot.connectionId,
    ingested,
    scanned: snapshot.deals.length,
    days: window.days,
    balance: snapshot.balance,
    equity: snapshot.equity,
    syncedAt: new Date().toISOString(),
  };
}
