import { ensureTradingAccountPersisted } from "@/lib/supabase/accounts";
import { requireUserSession } from "@/lib/supabase/session";
import type { TradeInsert, TradeRow, TradeUpdate } from "@/lib/supabase/database.types";
import {
  readTradeAccountMap,
  removeTradeAccountMapEntries,
  tradesForAccount,
  writeTradeAccountMapEntry,
} from "@/lib/trades/account-balance";
import {
  chartPayloadBytes,
  compressTradeCharts,
} from "@/lib/trades/chart-image";
import { asScore, asStringArray, decodeNotesWithMeta, encodeNotesWithMeta } from "@/lib/trades/journal-meta";
import { normalizeTrade } from "@/lib/trades/load-trades";
import { formDataToTrade } from "@/lib/trades/trade-form";
import {
  getCachedTrades,
  loadTradesCache,
  removeTradesFromCache,
  upsertTradeInCache,
} from "@/lib/trades/trades-cache";
import type { Trade, TradeFormData } from "@/lib/types/trade";

const HEAVY_CHART_CHARS = 420_000;
const confirmedAccountIds = new Set<string>();

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function isMissingStrategyColumn(error: { message: string } | null) {
  return Boolean(error?.message.toLowerCase().includes("strategy"));
}

function isMissingAccountColumn(error: { message: string } | null) {
  const message = error?.message.toLowerCase() ?? "";
  if (
    message.includes("trades_account_id_fkey") ||
    message.includes("foreign key")
  ) {
    return false;
  }
  return (
    (message.includes("column") && message.includes("account_id")) ||
    (message.includes("schema cache") && message.includes("account_id"))
  );
}

function isAccountForeignKeyViolation(error: { message: string } | null) {
  const message = error?.message.toLowerCase() ?? "";
  return (
    message.includes("trades_account_id_fkey") ||
    (message.includes("foreign key") && message.includes("account_id"))
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
  return requireUserSession();
}

function applyAccountFallback(trade: Trade, map: Record<string, string>): Trade {
  if (trade.accountId) return trade;
  return { ...trade, accountId: map[trade.id] ?? "" };
}

function persistableNotes(
  data: Pick<
    Trade | TradeFormData,
    | "notes"
    | "exitPrice"
    | "emotionBefore"
    | "emotionAfter"
    | "ruleScore"
    | "checkedRuleIds"
  >
) {
  return encodeNotesWithMeta(data.notes ?? "", {
    exitPrice: data.exitPrice ?? "",
    emotionBefore: data.emotionBefore ?? null,
    emotionAfter: data.emotionAfter ?? null,
    ruleScore: data.ruleScore ?? null,
    checkedRuleIds: data.checkedRuleIds ?? [],
  });
}

export function tradeFromRow(row: TradeRow): Trade {
  const extra = row as TradeRow & {
    rule_score?: number | null;
    ruleScore?: number | null;
    checked_rule_ids?: string[] | null;
    checkedRuleIds?: string[] | null;
  };
  const decoded = decodeNotesWithMeta(row.notes ?? "");
  const columnIds = asStringArray(
    extra.checked_rule_ids ?? extra.checkedRuleIds
  );

  return {
    id: row.id,
    pair: row.pair,
    higherTimeFrame: row.higher_time_frame,
    middleTimeFrame: row.middle_time_frame,
    lowerTimeFrame: row.lower_time_frame,
    entry: row.entry,
    direction: row.direction,
    entryPrice: row.entry_price,
    exitPrice: "",
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
    emotionBefore: null,
    emotionAfter: null,
    ruleScore:
      asScore(extra.rule_score ?? extra.ruleScore) ?? decoded.meta.ruleScore,
    checkedRuleIds:
      columnIds.length > 0 ? columnIds : decoded.meta.checkedRuleIds,
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
    notes: persistableNotes(trade),
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
    notes: persistableNotes(data),
    before_chart: data.beforeChart,
    after_chart: data.afterChart,
    ...(data.createdAt ? { created_at: data.createdAt } : {}),
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

async function fetchTradesFromNetwork(): Promise<Trade[]> {
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

export async function fetchTrades(options?: { force?: boolean }): Promise<Trade[]> {
  return loadTradesCache(fetchTradesFromNetwork, options?.force);
}

async function attachPersistedAccountId<
  T extends { account_id?: string | null },
>(payload: T, accountId: string | null | undefined): Promise<T> {
  const requested = accountId?.trim() || payload.account_id || "";
  if (!requested) return withoutAccountId(payload) as T;
  if (confirmedAccountIds.has(requested)) {
    return { ...payload, account_id: requested };
  }
  const persisted = await ensureTradingAccountPersisted(requested);
  if (!persisted) return withoutAccountId(payload) as T;
  confirmedAccountIds.add(persisted);
  return { ...payload, account_id: persisted };
}

function splitHeavyCharts<T extends TradeInsert | TradeUpdate>(payload: T) {
  const before = payload.before_chart ?? null;
  const after = payload.after_chart ?? null;
  if (chartPayloadBytes(before, after) <= HEAVY_CHART_CHARS) {
    return {
      payload,
      deferred: null as { before_chart: string | null; after_chart: string | null } | null,
    };
  }
  return {
    payload: { ...payload, before_chart: null, after_chart: null } as T,
    deferred: { before_chart: before, after_chart: after },
  };
}

async function insertPayload(
  supabase: Awaited<ReturnType<typeof requireUserId>>["supabase"],
  payload: TradeInsert
) {
  return supabase.from("trades").insert(payload);
}

async function updatePayload(
  supabase: Awaited<ReturnType<typeof requireUserId>>["supabase"],
  id: string,
  userId: string,
  payload: TradeUpdate
) {
  return supabase.from("trades").update(payload).eq("id", id).eq("user_id", userId);
}

async function persistChartsLater(
  supabase: Awaited<ReturnType<typeof requireUserId>>["supabase"],
  id: string,
  userId: string,
  charts: { before_chart: string | null; after_chart: string | null }
) {
  void supabase.from("trades").update(charts).eq("id", id).eq("user_id", userId);
}

export async function insertTrade(data: TradeFormData): Promise<Trade> {
  const prepared = await compressTradeCharts(data);
  const id = crypto.randomUUID();
  const createdAt = prepared.createdAt || new Date().toISOString();
  const optimistic = applyAccountFallback(
    normalizeTrade(formDataToTrade({ ...prepared, createdAt }, id, createdAt)),
    readTradeAccountMap()
  );
  upsertTradeInCache(optimistic);
  if (optimistic.accountId) writeTradeAccountMapEntry(id, optimistic.accountId);

  try {
    const { supabase, userId } = await requireUserId();
    let payload: TradeInsert = await attachPersistedAccountId(
      { ...tradeFormToInsert(prepared, userId), id, created_at: createdAt },
      prepared.accountId
    );
    const split = splitHeavyCharts(payload);
    payload = split.payload;

    let { error } = await insertPayload(supabase, payload);

    if (isAccountForeignKeyViolation(error) && payload.account_id) {
      confirmedAccountIds.delete(payload.account_id);
      payload = await attachPersistedAccountId(payload, payload.account_id);
      error = (await insertPayload(supabase, payload)).error;
    }

    if (isMissingAccountColumn(error)) {
      payload = withoutAccountId(payload);
      error = (await insertPayload(supabase, payload)).error;
    }

    if (isMissingStrategyColumn(error)) {
      payload = {
        ...withoutStrategy(payload),
        notes: persistStrategyInNotes(payload.strategy, payload.notes),
      };
      error = (await insertPayload(supabase, payload)).error;
    }

    throwIfError(error);
    if (split.deferred) {
      persistChartsLater(supabase, id, userId, split.deferred);
    }
    return optimistic;
  } catch (cause) {
    removeTradesFromCache([id]);
    throw cause;
  }
}

export async function updateTrade(
  id: string,
  data: TradeFormData
): Promise<Trade> {
  const existing = getCachedTrades()?.find((trade) => trade.id === id);
  const prepared = await compressTradeCharts(data);
  const updated = applyAccountFallback(
    normalizeTrade(
      formDataToTrade(
        prepared,
        id,
        existing?.createdAt || prepared.createdAt || new Date().toISOString()
      )
    ),
    readTradeAccountMap()
  );
  upsertTradeInCache(updated);

  const { supabase, userId } = await requireUserId();
  let payload: TradeUpdate = await attachPersistedAccountId(
    tradeFormToUpdate(prepared),
    prepared.accountId
  );
  if (existing?.beforeChart === prepared.beforeChart) {
    delete payload.before_chart;
  }
  if (existing?.afterChart === prepared.afterChart) {
    delete payload.after_chart;
  }
  const split = splitHeavyCharts(payload);
  payload = split.payload;

  let { error } = await updatePayload(supabase, id, userId, payload);

  if (isAccountForeignKeyViolation(error) && payload.account_id) {
    confirmedAccountIds.delete(payload.account_id);
    payload = await attachPersistedAccountId(payload, payload.account_id);
    error = (await updatePayload(supabase, id, userId, payload)).error;
  }

  if (isMissingAccountColumn(error)) {
    payload = withoutAccountId(payload);
    error = (await updatePayload(supabase, id, userId, payload)).error;
  }

  if (isMissingStrategyColumn(error)) {
    payload = {
      ...withoutStrategy(payload),
      notes: persistStrategyInNotes(payload.strategy, payload.notes),
    };
    error = (await updatePayload(supabase, id, userId, payload)).error;
  }

  if (error) {
    if (existing) upsertTradeInCache(existing);
    throwIfError(error);
  }
  const accountId = payload.account_id || prepared.accountId;
  if (accountId) writeTradeAccountMapEntry(id, accountId);
  if (split.deferred) {
    persistChartsLater(supabase, id, userId, split.deferred);
  }
  return updated;
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
  removeTradesFromCache([id]);
}

export async function deleteTradesForAccount(
  accountId: string,
  fallbackAccountId: string
): Promise<void> {
  const trades = getCachedTrades() ?? (await fetchTrades());
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
  removeTradesFromCache(ids);
}
