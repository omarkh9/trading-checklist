import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TradeInsert } from "@/lib/supabase/database.types";
import { persistMt5Snapshot } from "@/lib/mt5/persist-credentials";
import type { Mt5IngestTrade } from "@/lib/mt5/trades";

const CHUNK = 40;

export function mt5TradesToInserts(
  trades: Mt5IngestTrade[],
  userId: string,
  accountId: string
): TradeInsert[] {
  return trades.map((trade) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    pair: trade.pair,
    direction: trade.direction,
    entry_price: trade.entryPrice,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    outcome: trade.outcome,
    pnl_mode: "dollar",
    pnl_input: String(trade.pnlDollars),
    pnl_dollars: trade.pnlDollars,
    risk_size_mode: "fixed",
    risk_percent: "",
    fixed_lot_size: trade.lotSize,
    lot_size: trade.lotSize,
    account_balance_at_entry: trade.accountBalanceAtEntry,
    account_id: accountId,
    strategy: "MT5",
    notes: trade.notes,
    created_at: trade.createdAt,
    mt5_ticket: trade.ticket,
  }));
}

export async function upsertMt5Trades(
  supabase: SupabaseClient<Database>,
  rows: TradeInsert[]
) {
  let ingested = 0;
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK);
    const upserted = await supabase.from("trades").upsert(chunk, {
      onConflict: "user_id,mt5_ticket",
    });
    if (!upserted.error) {
      ingested += chunk.length;
      continue;
    }

    for (const row of chunk) {
      const inserted = await supabase.from("trades").insert(row);
      if (!inserted.error) {
        ingested += 1;
        continue;
      }

      const updated = await supabase
        .from("trades")
        .update({
          pair: row.pair,
          direction: row.direction,
          entry_price: row.entry_price,
          stop_loss: row.stop_loss,
          take_profit: row.take_profit,
          outcome: row.outcome,
          pnl_input: row.pnl_input,
          pnl_dollars: row.pnl_dollars,
          lot_size: row.lot_size,
          account_balance_at_entry: row.account_balance_at_entry,
          notes: row.notes,
          created_at: row.created_at,
          account_id: row.account_id,
          strategy: row.strategy,
        })
        .eq("user_id", row.user_id)
        .eq("mt5_ticket", row.mt5_ticket ?? "");
      if (!updated.error) ingested += 1;
    }
  }
  return ingested;
}

function finiteMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readBrokerSnapshotMoney(input: {
  balance?: number | null;
  equity?: number | null;
}) {
  const balance = finiteMoney(input.balance) ?? finiteMoney(input.equity);
  const equity = finiteMoney(input.equity) ?? balance;
  if (balance == null || equity == null) {
    return { balance: null, equity: null };
  }
  return { balance, equity };
}

export async function markMt5Synced(
  supabase: SupabaseClient<Database>,
  input: {
    accountId: string;
    userId: string;
    balance?: number | null;
    equity?: number | null;
    connectionId?: string;
  }
) {
  const syncedAt = new Date().toISOString();
  const money = readBrokerSnapshotMoney(input);
  if (money.balance == null || money.equity == null) {
    await supabase
      .from("trading_accounts")
      .update({ mt5_synced_at: syncedAt })
      .eq("id", input.accountId)
      .eq("user_id", input.userId);
    return { balance: null, equity: null, syncedAt };
  }
  const { balance, equity } = money;

  return persistMt5Snapshot(supabase, {
    userId: input.userId,
    accountId: input.accountId,
    balance,
    equity,
    connectionId: input.connectionId,
    syncedAt,
  });
}
