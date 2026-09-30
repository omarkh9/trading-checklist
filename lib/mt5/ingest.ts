import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  TradeInsert,
  TradeRow,
  TradeUpdate,
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

// Columns the broker is the source of truth for. Everything else on a trade
// (id, notes with emotions/rule scores, strategy, charts, time frames) belongs
// to the journal and must survive a re-sync.
const BROKER_COLUMNS =
  "id, mt5_ticket, pair, direction, entry_price, stop_loss, take_profit, outcome, pnl_input, pnl_dollars, lot_size, created_at, account_id";

type BrokerFields = Pick<
  TradeRow,
  | "id"
  | "mt5_ticket"
  | "pair"
  | "direction"
  | "entry_price"
  | "stop_loss"
  | "take_profit"
  | "outcome"
  | "pnl_input"
  | "pnl_dollars"
  | "lot_size"
  | "created_at"
  | "account_id"
>;

async function loadExistingMt5Trades(
  supabase: SupabaseClient<Database>,
  userId: string,
  tickets: string[]
) {
  const existing = new Map<string, BrokerFields>();
  for (let index = 0; index < tickets.length; index += 100) {
    const { data, error } = await supabase
      .from("trades")
      .select(BROKER_COLUMNS)
      .eq("user_id", userId)
      .in("mt5_ticket", tickets.slice(index, index + 100));
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as BrokerFields[]) {
      if (row.mt5_ticket) existing.set(row.mt5_ticket, row);
    }
  }
  return existing;
}

function brokerChanges(row: TradeInsert, current: BrokerFields): TradeUpdate {
  const changes: TradeUpdate = {};
  if (row.pair !== current.pair) changes.pair = row.pair;
  if (row.direction !== current.direction) changes.direction = row.direction;
  if (row.entry_price && row.entry_price !== current.entry_price) {
    changes.entry_price = row.entry_price;
  }
  // A blank broker SL/TP means "none on the order", not "clear the journal's".
  if (row.stop_loss && row.stop_loss !== current.stop_loss) {
    changes.stop_loss = row.stop_loss;
  }
  if (row.take_profit && row.take_profit !== current.take_profit) {
    changes.take_profit = row.take_profit;
  }
  if (row.lot_size && row.lot_size !== current.lot_size) {
    changes.lot_size = row.lot_size;
  }
  // pnl_dollars is numeric(18,2); the broker sum is an unrounded float.
  if (
    Math.round(Number(row.pnl_dollars) * 100) !==
    Math.round(Number(current.pnl_dollars) * 100)
  ) {
    changes.pnl_mode = "dollar";
    changes.pnl_input = row.pnl_input;
    changes.pnl_dollars = row.pnl_dollars;
  }
  if (row.outcome !== current.outcome) changes.outcome = row.outcome;
  if (
    row.created_at &&
    Date.parse(row.created_at) !== Date.parse(current.created_at)
  ) {
    changes.created_at = row.created_at;
  }
  if (row.account_id && row.account_id !== current.account_id) {
    changes.account_id = row.account_id;
  }
  return changes;
}

export async function upsertMt5Trades(
  supabase: SupabaseClient<Database>,
  rows: TradeInsert[]
) {
  const userId = rows[0]?.user_id;
  if (!userId) return 0;

  const existing = await loadExistingMt5Trades(
    supabase,
    userId,
    rows.map((row) => row.mt5_ticket ?? "").filter(Boolean)
  );

  const inserts: TradeInsert[] = [];
  const updates: { id: string; changes: TradeUpdate }[] = [];
  for (const row of rows) {
    const current = row.mt5_ticket ? existing.get(row.mt5_ticket) : undefined;
    if (!current) {
      inserts.push(row);
      continue;
    }
    const changes = brokerChanges(row, current);
    if (Object.keys(changes).length > 0) {
      updates.push({ id: current.id, changes });
    }
  }

  console.info("MT5 trades to write", {
    total: rows.length,
    existing: existing.size,
    inserts: inserts.length,
    updates: updates.length,
  });

  let ingested = 0;
  for (let index = 0; index < inserts.length; index += CHUNK) {
    const chunk = inserts.slice(index, index + CHUNK);
    // DO NOTHING on conflict: a concurrent sync may have inserted the ticket.
    const upserted = await supabase.from("trades").upsert(chunk, {
      onConflict: "user_id,mt5_ticket",
      ignoreDuplicates: true,
    });
    if (!upserted.error) {
      ingested += chunk.length;
      continue;
    }
    for (const row of chunk) {
      const inserted = await supabase.from("trades").insert(row);
      if (!inserted.error) ingested += 1;
    }
  }

  // Closed deals rarely change, so this is usually empty. Run a few at a time
  // so a one-off bulk correction (e.g. trade times) stays inside the timeout.
  for (let index = 0; index < updates.length; index += 10) {
    const results = await Promise.all(
      updates.slice(index, index + 10).map(({ id, changes }) =>
        supabase
          .from("trades")
          .update(changes)
          .eq("id", id)
          .eq("user_id", userId)
      )
    );
    ingested += results.filter((result) => !result.error).length;
  }
  return ingested;
}

const ACCOUNT_SCOPE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireScopedAccount(accountId: string, userId: string) {
  const id = accountId.trim();
  const uid = userId.trim();
  if (!id || !uid || !ACCOUNT_SCOPE_ID.test(id) || !ACCOUNT_SCOPE_ID.test(uid)) {
    throw new Error(
      "MT5 sync refused to update trading_accounts without an exact account id and user id."
    );
  }
  return { accountId: id, userId: uid };
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

export function positiveMt5Money(value: unknown): number | null {
  const parsed = toFloat(value);
  return parsed != null && parsed > 0 ? parsed : null;
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
  const scope = requireScopedAccount(input.accountId, input.userId);
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
      .eq("id", scope.accountId)
      .eq("user_id", scope.userId)
      .select("id, mt5_balance, mt5_equity, mt5_synced_at")
      .maybeSingle();

    if (data?.id && data.id !== scope.accountId) {
      throw new Error("MT5 sync matched a different trading account.");
    }

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

  const { data: written, error } = await supabase
    .from("trading_accounts")
    .update({
      mt5_balance: input.balance,
      mt5_equity: input.equity,
      mt5_synced_at: input.syncedAt,
    })
    .eq("id", scope.accountId)
    .eq("user_id", scope.userId)
    .select("id")
    .maybeSingle();

  if (written?.id && written.id !== scope.accountId) {
    throw new Error("MT5 sync matched a different trading account.");
  }

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
  const scope = requireScopedAccount(input.accountId, input.userId);
  const payload = input.snapshot ?? input;
  console.log(JSON.stringify(payload));
  const syncedAt = new Date().toISOString();
  const money = readMt5GatewayMoney(payload);
  const balance = positiveMt5Money(input.balance) ?? positiveMt5Money(money.balance);
  const equity =
    positiveMt5Money(input.equity) ?? positiveMt5Money(money.equity) ?? balance;
  if (balance == null || equity == null) {
    const { data: stored } = await supabase
      .from("trading_accounts")
      .update({
        mt5_synced_at: syncedAt,
        ...(input.connectionId ? { mt5_connection_id: input.connectionId } : {}),
      })
      .eq("id", scope.accountId)
      .eq("user_id", scope.userId)
      .select("id, mt5_balance, mt5_equity, mt5_synced_at")
      .maybeSingle();
    if (stored?.id && stored.id !== scope.accountId) {
      throw new Error("MT5 sync matched a different trading account.");
    }
    const storedBalance = positiveMt5Money(stored?.mt5_balance);
    return {
      balance: storedBalance,
      equity: positiveMt5Money(stored?.mt5_equity) ?? storedBalance,
      syncedAt: stored?.mt5_synced_at ?? syncedAt,
    };
  }

  try {
    return await writeMt5BalanceColumns(supabase, {
      accountId: scope.accountId,
      userId: scope.userId,
      balance,
      equity,
      connectionId: input.connectionId,
      syncedAt,
    });
  } catch {
    return persistMt5Snapshot(supabase, {
      userId: scope.userId,
      accountId: scope.accountId,
      balance,
      equity,
      connectionId: input.connectionId,
      syncedAt,
    });
  }
}
