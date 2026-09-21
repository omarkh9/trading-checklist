import { emptyTradeForm, type Trade, type TradeFormData } from "@/lib/types/trade";

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
