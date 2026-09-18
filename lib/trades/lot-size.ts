import type { RiskSizeMode } from "@/lib/types/trade";
import { parseNumericInput } from "@/lib/trades/pnl";

type LotSizeInput = {
  riskSizeMode: RiskSizeMode;
  riskPercent: string;
  fixedLotSize: string;
  entryPrice: string;
  stopLoss: string;
  accountBalance: number;
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

  const riskAmount = input.accountBalance * (riskPercent / 100);
  return riskAmount / priceRisk;
}

export function formatLotSize(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
}
