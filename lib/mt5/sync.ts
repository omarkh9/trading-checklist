import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchMt5History } from "@/lib/mt5/history";
import {
  markMt5Synced,
  mt5TradesToInserts,
  positiveMt5Money,
  readMt5GatewayMoney,
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
  const started = Date.now();
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
  const fetchedAt = Date.now();
  console.info("MT5 sync fetched", {
    accountId: options.accountId,
    days: window.days,
    deals: snapshot.deals.length,
    trades: trades.length,
    fetchMs: fetchedAt - started,
  });
  const ingested = await upsertMt5Trades(
    options.supabase,
    mt5TradesToInserts(trades, options.userId, options.accountId)
  );
  console.info("MT5 sync saved trades", {
    accountId: options.accountId,
    ingested,
    upsertMs: Date.now() - fetchedAt,
  });

  const rawMoney = readMt5GatewayMoney(snapshot.raw);
  const rawMetrics = readMt5AccountMetrics(snapshot.raw);
  const liveBalance = firstPositive(
    snapshot.balance,
    rawMoney.balance,
    rawMetrics.balance,
    snapshotMetrics.balance
  );
  const liveEquity =
    firstPositive(
      snapshot.equity,
      rawMoney.equity,
      rawMetrics.equity,
      snapshotMetrics.equity
    ) ?? liveBalance;

  const saved = await markMt5Synced(options.supabase, {
    accountId: options.accountId,
    userId: options.userId,
    balance: liveBalance ?? undefined,
    equity: liveEquity ?? undefined,
    connectionId: snapshot.connectionId,
    snapshot: snapshot.raw ?? snapshot,
  });

  const balance = positiveMt5Money(saved.balance);
  const equity = positiveMt5Money(saved.equity) ?? balance;
  const syncedAt = saved.syncedAt ?? new Date().toISOString();

  return {
    ok: true as const,
    accountId: options.accountId,
    connectionId: snapshot.connectionId || undefined,
    ingested,
    scanned: snapshot.deals.length,
    days: window.days,
    live: liveBalance != null,
    balance,
    equity,
    mt5_balance: balance,
    mt5_equity: equity,
    mt5Balance: balance,
    mt5Equity: equity,
    syncedAt,
  };
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const money = positiveMt5Money(value);
    if (money != null) return money;
  }
  return null;
}
