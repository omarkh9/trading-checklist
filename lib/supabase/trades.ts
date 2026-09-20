import { createClient } from "@/lib/supabase/client";
import type { TradeInsert, TradeRow, TradeUpdate } from "@/lib/supabase/database.types";
import {
  readTradeAccountMap,
  removeTradeAccountMapEntries,
  tradesForAccount,
  writeTradeAccountMapEntry,
} from "@/lib/trades/account-balance";
import { normalizeTrade } from "@/lib/trades/load-trades";
import type { Trade, TradeFormData } from "@/lib/types/trade";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function isMissingStrategyColumn(error: { message: string } | null) {
  return Boolean(error?.message.toLowerCase().includes("strategy"));
}

function isMissingAccountColumn(error: { message: string } | null) {
  const message = error?.message.toLowerCase() ?? "";
  return (
    message.includes("account_id") ||
    message.includes("trading_accounts")
  );
}

function withoutStrategy<T extends { strategy?: string }>(payload: T) {
  const { strategy: _strategy, ...rest } = payload;
  return rest;
}

function withoutAccountId<T extends { account_id?: string | null }>(payload: T) {
  const { account_id: _accountId, ...rest } = payload;
  return rest;
}

function persistStrategyInNotes(strategy: string | undefined, notes: string | undefined) {
  const text = notes ?? "";
  const slug = (strategy ?? "").trim().replace(/\s+/g, "");
  if (!slug) return text;
  if (new RegExp(`#${slug}\\b`, "i").test(text)) return text;
  return text.trim() ? `#${slug} ${text}` : `#${slug}`;
}

async function requireUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  throwIfError(error);
  if (!user) throw new Error("You must be signed in to manage trades.");
  return { supabase, userId: user.id };
}

function applyAccountFallback(trade: Trade, map: Record<string, string>): Trade {
  if (trade.accountId) return trade;
  return { ...trade, accountId: map[trade.id] ?? "" };
}

export function tradeFromRow(row: TradeRow): Trade {
  return {
    id: row.id,
    pair: row.pair,
    higherTimeFrame: row.higher_time_frame,
    middleTimeFrame: row.middle_time_frame,
    lowerTimeFrame: row.lower_time_frame,
    entry: row.entry,
    direction: row.direction,
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    outcome: row.outcome,
    pnlMode: row.pnl_mode,
    pnlInput: row.pnl_input,
    pnlDollars: row.pnl_dollars,
    riskSizeMode: row.risk_size_mode,
    riskPercent: row.risk_percent,
    fixedLotSize: row.fixed_lot_size,
    lotSize: row.lot_size,
    accountBalanceAtEntry: row.account_balance_at_entry,
    accountId: row.account_id ?? "",
    strategy: row.strategy ?? "",
    notes: row.notes,
    beforeChart: row.before_chart,
    afterChart: row.after_chart,
    createdAt: row.created_at,
  };
}

export function tradeToInsert(trade: Trade, userId: string): TradeInsert {
  return {
    id: trade.id,
    user_id: userId,
    pair: trade.pair,
    higher_time_frame: trade.higherTimeFrame,
    middle_time_frame: trade.middleTimeFrame,
    lower_time_frame: trade.lowerTimeFrame,
    entry: trade.entry,
    direction: trade.direction,
    entry_price: trade.entryPrice,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    outcome: trade.outcome,
    pnl_mode: trade.pnlMode,
    pnl_input: trade.pnlInput,
    pnl_dollars: trade.pnlDollars,
    risk_size_mode: trade.riskSizeMode,
    risk_percent: trade.riskPercent,
    fixed_lot_size: trade.fixedLotSize,
    lot_size: trade.lotSize,
    account_balance_at_entry: trade.accountBalanceAtEntry,
    account_id: trade.accountId || null,
    strategy: trade.strategy,
    notes: trade.notes,
    before_chart: trade.beforeChart,
    after_chart: trade.afterChart,
    created_at: trade.createdAt,
  };
}

export function tradeFormToInsert(
  data: TradeFormData,
  userId: string
): TradeInsert {
  return {
    user_id: userId,
    pair: data.pair,
    higher_time_frame: data.higherTimeFrame,
    middle_time_frame: data.middleTimeFrame,
    lower_time_frame: data.lowerTimeFrame,
    entry: data.entry,
    direction: data.direction,
    entry_price: data.entryPrice,
    stop_loss: data.stopLoss,
    take_profit: data.takeProfit,
    outcome: data.outcome,
    pnl_mode: data.pnlMode,
    pnl_input: data.pnlInput,
    pnl_dollars: data.pnlDollars,
    risk_size_mode: data.riskSizeMode,
    risk_percent: data.riskPercent,
    fixed_lot_size: data.fixedLotSize,
    lot_size: data.lotSize,
    account_balance_at_entry: data.accountBalanceAtEntry,
    account_id: data.accountId || null,
    strategy: (data.strategy ?? "").trim(),
    notes: data.notes,
    before_chart: data.beforeChart,
    after_chart: data.afterChart,
  };
}

export function tradeFormToUpdate(data: TradeFormData): TradeUpdate {
  const insert = tradeFormToInsert(data, "unused");
  return {
    pair: insert.pair,
    higher_time_frame: insert.higher_time_frame,
    middle_time_frame: insert.middle_time_frame,
    lower_time_frame: insert.lower_time_frame,
    entry: insert.entry,
    direction: insert.direction,
    entry_price: insert.entry_price,
    stop_loss: insert.stop_loss,
    take_profit: insert.take_profit,
    outcome: insert.outcome,
    pnl_mode: insert.pnl_mode,
    pnl_input: insert.pnl_input,
    pnl_dollars: insert.pnl_dollars,
    risk_size_mode: insert.risk_size_mode,
    risk_percent: insert.risk_percent,
    fixed_lot_size: insert.fixed_lot_size,
    lot_size: insert.lot_size,
    account_balance_at_entry: insert.account_balance_at_entry,
    account_id: insert.account_id,
    strategy: insert.strategy,
    notes: insert.notes,
    before_chart: insert.before_chart,
    after_chart: insert.after_chart,
  };
}

export async function fetchTrades(): Promise<Trade[]> {
  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwIfError(error);
  const map = readTradeAccountMap();
  return (data ?? []).map((row) =>
    applyAccountFallback(normalizeTrade(tradeFromRow(row)), map)
  );
}

export async function insertTrade(data: TradeFormData): Promise<Trade> {
  const { supabase, userId } = await requireUserId();
  let payload: TradeInsert = tradeFormToInsert(data, userId);
  let { data: row, error } = await supabase
    .from("trades")
    .insert(payload)
    .select()
    .single();

  if (isMissingAccountColumn(error)) {
    payload = withoutAccountId(payload);
    const retry = await supabase
      .from("trades")
      .insert(payload)
      .select()
      .single();
    row = retry.data;
    error = retry.error;
  }

  if (isMissingStrategyColumn(error)) {
    payload = {
      ...withoutStrategy(payload),
      notes: persistStrategyInNotes(payload.strategy, payload.notes),
    };
    const retry = await supabase
      .from("trades")
      .insert(payload)
      .select()
      .single();
    row = retry.data;
    error = retry.error;
  }

  throwIfError(error);
  if (!row) throw new Error("Trade was not saved.");
  if (data.accountId) writeTradeAccountMapEntry(row.id, data.accountId);
  return applyAccountFallback(
    normalizeTrade(tradeFromRow(row)),
    readTradeAccountMap()
  );
}

export async function updateTrade(
  id: string,
  data: TradeFormData
): Promise<Trade> {
  const { supabase, userId } = await requireUserId();
  let payload: TradeUpdate = tradeFormToUpdate(data);
  let { data: row, error } = await supabase
    .from("trades")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (isMissingAccountColumn(error)) {
    payload = withoutAccountId(payload);
    const retry = await supabase
      .from("trades")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    row = retry.data;
    error = retry.error;
  }

  if (isMissingStrategyColumn(error)) {
    payload = {
      ...withoutStrategy(payload),
      notes: persistStrategyInNotes(payload.strategy, payload.notes),
    };
    const retry = await supabase
      .from("trades")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    row = retry.data;
    error = retry.error;
  }

  throwIfError(error);
  if (!row) throw new Error("Trade was not updated.");
  if (data.accountId) writeTradeAccountMapEntry(id, data.accountId);
  return applyAccountFallback(
    normalizeTrade(tradeFromRow(row)),
    readTradeAccountMap()
  );
}

export async function deleteTrade(id: string): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error);
  removeTradeAccountMapEntries([id]);
}

export async function deleteTradesForAccount(
  accountId: string,
  fallbackAccountId: string
): Promise<void> {
  const trades = await fetchTrades();
  const ids = tradesForAccount(trades, accountId, fallbackAccountId).map(
    (trade) => trade.id
  );
  if (ids.length === 0) return;

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
  throwIfError(error);
  removeTradeAccountMapEntries(ids);
}
