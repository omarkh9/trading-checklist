import { emptyTradeForm, type Trade, type TradeFormData } from "@/lib/types/trade";

export function formDataToTrade(
  data: TradeFormData,
  id: string,
  createdAt: string
): Trade {
  return {
    id,
    pair: data.pair,
    higherTimeFrame: data.higherTimeFrame,
    middleTimeFrame: data.middleTimeFrame,
    lowerTimeFrame: data.lowerTimeFrame,
    entry: data.entry,
    direction: data.direction,
    entryPrice: data.entryPrice,
    exitPrice: data.exitPrice,
    stopLoss: data.stopLoss,
    takeProfit: data.takeProfit,
    outcome: data.outcome,
    pnlMode: data.pnlMode,
    pnlInput: data.pnlInput,
    pnlDollars: data.pnlDollars,
    riskSizeMode: data.riskSizeMode,
    riskPercent: data.riskPercent,
    fixedLotSize: data.fixedLotSize,
    lotSize: data.lotSize,
    accountBalanceAtEntry: data.accountBalanceAtEntry,
    accountId: data.accountId,
    strategy: data.strategy,
    notes: data.notes,
    emotionBefore: data.emotionBefore,
    emotionAfter: data.emotionAfter,
    ruleScore: data.ruleScore,
    checkedRuleIds: data.checkedRuleIds,
    beforeChart: data.beforeChart,
    afterChart: data.afterChart,
    createdAt,
  };
}

export function tradeToFormData(trade: Trade): TradeFormData {
  const defaults = emptyTradeForm();
  const { id: _id, createdAt: _createdAt, ...formData } = trade;
  return {
    ...defaults,
    ...formData,
    strategy: (formData.strategy ?? "").trim(),
    accountId: formData.accountId ?? "",
    exitPrice: formData.exitPrice ?? "",
    emotionBefore: formData.emotionBefore ?? null,
    emotionAfter: formData.emotionAfter ?? null,
    ruleScore: formData.ruleScore ?? null,
    checkedRuleIds: formData.checkedRuleIds ?? [],
  };
}
