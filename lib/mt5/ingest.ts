import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  TradeInsert,
  TradingAccountUpdate,
} from "@/lib/supabase/database.types";
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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toFloat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim().replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readMt5GatewayMoney(payload: unknown) {
  const root = asObject(payload);
  const answer = asObject(root.answer);
  const balance = toFloat(answer.Balance ?? root.Balance);
  const equity = toFloat(answer.Equity ?? root.Equity);
  if (balance == null && equity == null) {
    return { balance: null, equity: null };
  }
  return {
    balance: balance ?? equity,
    equity: equity ?? balance,
  };
}

export function readBrokerSnapshotMoney(input: {
  balance?: unknown;
  equity?: unknown;
}) {
  return readMt5GatewayMoney({
    answer: { Balance: input.balance, Equity: input.equity },
    Balance: input.balance,
    Equity: input.equity,
  });
}

async function writeMt5BalanceColumns(
  supabase: SupabaseClient<Database>,
  input: {
    accountId: string;
    userId: string;
    balance: number;
    equity: number;
    connectionId?: string;
    syncedAt: string;
  }
) {
  const moneyFields: TradingAccountUpdate = {
    mt5_balance: input.balance,
    mt5_equity: input.equity,
    mt5_synced_at: input.syncedAt,
  };
  const attempts: TradingAccountUpdate[] = [
    {
      ...moneyFields,
      ...(input.connectionId ? { mt5_connection_id: input.connectionId } : {}),
    },
    moneyFields,
  ];

  for (const fields of attempts) {
    const { data, error } = await supabase
      .from("trading_accounts")
      .update(fields)
      .eq("id", input.accountId)
      .eq("user_id", input.userId)
      .select("id, mt5_balance, mt5_equity, mt5_synced_at")
      .maybeSingle();

    if (
      !error &&
      typeof data?.mt5_balance === "number" &&
      Number.isFinite(data.mt5_balance)
    ) {
      return {
        balance: data.mt5_balance,
        equity:
          typeof data.mt5_equity === "number" && Number.isFinite(data.mt5_equity)
            ? data.mt5_equity
            : input.equity,
        syncedAt: data.mt5_synced_at ?? input.syncedAt,
      };
    }

    if (error) {
      console.error("Full Supabase Error:", error);
    }
  }

  const { error } = await supabase
    .from("trading_accounts")
    .update({
      mt5_balance: input.balance,
      mt5_equity: input.equity,
      mt5_synced_at: input.syncedAt,
    })
    .eq("id", input.accountId)
    .eq("user_id", input.userId);

  if (error) {
    console.error("Full Supabase Error:", error);
    throw new Error(
      error.message || "Could not write mt5_balance and mt5_equity."
    );
  }

  return {
    balance: input.balance,
    equity: input.equity,
    syncedAt: input.syncedAt,
  };
}

export async function markMt5Synced(
  supabase: SupabaseClient<Database>,
  input: {
    accountId: string;
    userId: string;
    balance?: unknown;
    equity?: unknown;
    connectionId?: string;
    snapshot?: unknown;
  }
) {
  const payload = input.snapshot ?? input;
  console.log(JSON.stringify(payload));
  const syncedAt = new Date().toISOString();
  const money = readMt5GatewayMoney(payload);
  const balance = toFloat(input.balance) ?? money.balance;
  const equity = toFloat(input.equity) ?? money.equity ?? balance;
  if (balance == null || equity == null) {
    await supabase
      .from("trading_accounts")
      .update({ mt5_synced_at: syncedAt })
      .eq("id", input.accountId)
      .eq("user_id", input.userId);
    return { balance: null, equity: null, syncedAt };
  }

  try {
    return await writeMt5BalanceColumns(supabase, {
      accountId: input.accountId,
      userId: input.userId,
      balance,
      equity,
      connectionId: input.connectionId,
      syncedAt,
    });
  } catch {
    return persistMt5Snapshot(supabase, {
      userId: input.userId,
      accountId: input.accountId,
      balance,
      equity,
      connectionId: input.connectionId,
      syncedAt,
    });
  }
}
