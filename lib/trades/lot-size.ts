import { resolveAsset } from "@/lib/trades/assets";
import { usdValuePerPriceUnit } from "@/lib/trades/contract-math";
import type { Direction, RiskSizeMode } from "@/lib/types/trade";
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

export type PositionSizeResult = {
  lots: number;
  riskAmount: number;
  stopDistance: number;
  stopPips: number;
  pipValuePerLot: number;
};

export function calculateLotSize(input: LotSizeInput): number | null {
  return calculatePositionSize(input)?.lots ?? null;
}

export function calculatePositionSize(
  input: LotSizeInput
): PositionSizeResult | null {
  if (input.riskSizeMode === "fixed") {
    const lots = parseNumericInput(input.fixedLotSize);
    if (lots == null || lots <= 0) return null;
    const risk = analyzeStop(input);
    return {
      lots,
      riskAmount: risk ? lots * risk.riskPerLot : 0,
      stopDistance: risk?.stopDistance ?? 0,
      stopPips: risk?.stopPips ?? 0,
      pipValuePerLot: risk?.pipValuePerLot ?? 0,
    };
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
  const lots = riskAmount / riskPerLot;
  return {
    lots,
    riskAmount,
    stopDistance: priceRisk,
    stopPips: priceRisk / spec.pipSize,
    pipValuePerLot: perUnit.value * spec.pipSize,
  };
}

function analyzeStop(input: LotSizeInput) {
  const entry = parseNumericInput(input.entryPrice);
  const stop = parseNumericInput(input.stopLoss);
  if (entry == null || stop == null) return null;
  const stopDistance = Math.abs(entry - stop);
  if (stopDistance <= 0) return null;
  const { spec } = resolveAsset(input.pair);
  const perUnit = usdValuePerPriceUnit(spec, entry, input.quoteToUsd);
  if (!perUnit) return null;
  return {
    stopDistance,
    stopPips: stopDistance / spec.pipSize,
    pipValuePerLot: perUnit.value * spec.pipSize,
    riskPerLot: stopDistance * perUnit.value,
  };
}

export function calculateStopLossPrice(input: {
  pair: string;
  direction: Direction;
  entryPrice: string;
  lots: number | null;
  accountBalance: number;
  riskPercent: string;
  quoteToUsd?: number | null;
}): number | null {
  const entry = parseNumericInput(input.entryPrice);
  const riskPercent = parseNumericInput(input.riskPercent);
  if (
    entry == null ||
    riskPercent == null ||
    riskPercent <= 0 ||
    input.lots == null ||
    input.lots <= 0 ||
    input.accountBalance <= 0
  ) {
    return null;
  }

  const { spec } = resolveAsset(input.pair);
  const perUnit = usdValuePerPriceUnit(spec, entry, input.quoteToUsd);
  if (!perUnit) return null;

  const riskAmount = input.accountBalance * (riskPercent / 100);
  const stopDistance = riskAmount / (input.lots * perUnit.value);
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) return null;

  return input.direction === "Long" ? entry - stopDistance : entry + stopDistance;
}

export function formatLotSize(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

export function formatPrice(value: number | null, digits = 5): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(2);
  if (Math.abs(value) >= 10) return value.toFixed(3);
  return value.toFixed(digits);
}
