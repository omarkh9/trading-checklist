import type { Trade, TradeFormData } from "@/lib/types/trade";

export function tradeToFormData(trade: Trade): TradeFormData {
  const { id: _id, createdAt: _createdAt, ...formData } = trade;
  return {
    ...formData,
    strategy: (formData.strategy ?? "").trim(),
  };
}
