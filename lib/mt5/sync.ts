import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchMt5History } from "@/lib/mt5/history";
import {
  markMt5Synced,
  mt5TradesToInserts,
  readBrokerSnapshotMoney,
  upsertMt5Trades,
} from "@/lib/mt5/ingest";
import { parseMt5ClosedTrades, readMt5AccountMetrics } from "@/lib/mt5/trades";

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

  const snapshotMetrics = readMt5AccountMetrics({
    ...snapshot,
    deals: snapshot.deals,
    balance: snapshot.balance,
    equity: snapshot.equity,
  });
  const trades = parseMt5ClosedTrades(
    {
      deals: snapshot.deals,
      balance: snapshotMetrics.balance,
      equity: snapshotMetrics.equity,
    },
    snapshotMetrics.balance
  );
  const ingested = await upsertMt5Trades(
    options.supabase,
    mt5TradesToInserts(trades, options.userId, options.accountId)
  );

  const money = readBrokerSnapshotMoney({
    balance: snapshotMetrics.balance,
    equity: snapshotMetrics.equity,
  });

  const saved = await markMt5Synced(options.supabase, {
    accountId: options.accountId,
    userId: options.userId,
    balance: money.balance,
    equity: money.equity,
    connectionId: snapshot.connectionId,
  });

  const metrics = readMt5AccountMetrics({
    ...snapshot,
    balance: saved.balance ?? money.balance,
    equity: saved.equity ?? money.equity,
    mt5_balance: saved.balance ?? money.balance,
    mt5_equity: saved.equity ?? money.equity,
  });
  const syncedAt = saved.syncedAt ?? new Date().toISOString();

  return {
    ok: true as const,
    accountId: options.accountId,
    connectionId: snapshot.connectionId || undefined,
    ingested,
    scanned: snapshot.deals.length,
    days: window.days,
    balance: metrics.balance,
    equity: metrics.equity,
    mt5_balance: metrics.balance,
    mt5_equity: metrics.equity,
    mt5Balance: metrics.balance,
    mt5Equity: metrics.equity,
    syncedAt,
  };
}
