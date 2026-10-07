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

// Form state for editing an existing trade, with the defaults the form needs.
export function formStateFromInitial(
  initialData: TradeFormData,
  defaultAccountId: string,
  defaultRiskPercent: string
): TradeFormData {
  return {
    ...initialData,
    accountId: initialData.accountId || defaultAccountId,
    riskPercent: initialData.riskPercent || defaultRiskPercent,
    checkedRuleIds: initialData.checkedRuleIds ?? [],
    ruleScore: initialData.ruleScore ?? null,
  };
}

export function sameTradeFormData(a: TradeFormData, b: TradeFormData) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key as keyof TradeFormData];
    const right = b[key as keyof TradeFormData];
    if (Array.isArray(left) || Array.isArray(right)) {
      if (
        !Array.isArray(left) ||
        !Array.isArray(right) ||
        left.length !== right.length ||
        left.some((value, index) => value !== right[index])
      ) {
        return false;
      }
    } else if (left !== right) {
      return false;
    }
  }
  return true;
}

// The trade behind an open edit form gets re-read in the background (MT5
// auto-sync, the periodic refresh, regaining focus after the photo picker).
// Take fresh data only while the form is untouched; never overwrite edits.
export function reconcileTradeForm(
  current: TradeFormData,
  applied: TradeFormData,
  incoming: TradeFormData
) {
  if (sameTradeFormData(applied, incoming)) return current;
  return sameTradeFormData(current, applied) ? incoming : current;
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
