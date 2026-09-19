import { resolveAsset } from "@/lib/trades/assets";
import { usdValuePerPriceUnit } from "@/lib/trades/contract-math";
import type { RiskSizeMode } from "@/lib/types/trade";
import { parseNumericInput } from "@/lib/trades/pnl";

type LotSizeInput = {
  pair: string;
  riskSizeMode: RiskSizeMode;
  riskPercent: string;
  fixedLotSize: string;
  entryPrice: string;
  stopLoss: string;
  accountBalance: number;
  quoteToUsd?: number | null;
};

export function calculateLotSize(input: LotSizeInput): number | null {
  if (input.riskSizeMode === "fixed") {
    return parseNumericInput(input.fixedLotSize);
  }

  const riskPercent = parseNumericInput(input.riskPercent);
  const entry = parseNumericInput(input.entryPrice);
  const stop = parseNumericInput(input.stopLoss);

  if (
    riskPercent === null ||
    riskPercent <= 0 ||
    entry === null ||
    stop === null ||
    input.accountBalance <= 0
  ) {
    return null;
  }

  const priceRisk = Math.abs(entry - stop);
  if (priceRisk <= 0) return null;

  const { spec } = resolveAsset(input.pair);
  const perUnit = usdValuePerPriceUnit(spec, entry, input.quoteToUsd);
  if (!perUnit) return null;

  const riskPerLot = priceRisk * perUnit.value;
  if (riskPerLot <= 0) return null;

  const riskAmount = input.accountBalance * (riskPercent / 100);
  return riskAmount / riskPerLot;
}

export function formatLotSize(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
}
