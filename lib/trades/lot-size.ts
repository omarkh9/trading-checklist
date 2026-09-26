import { resolveAsset } from "@/lib/trades/assets";
import { snapLots, usdValuePerPriceUnit } from "@/lib/trades/contract-math";
import type { Direction, RiskSizeMode } from "@/lib/types/trade";
import { parseNumericInput } from "@/lib/trades/pnl";

export const BROKER_MIN_LOT = 0.01;

export function brokerMinLots(lotStep?: number) {
  const step = lotStep != null && lotStep > 0 ? lotStep : BROKER_MIN_LOT;
  return Math.max(BROKER_MIN_LOT, step);
}

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
  targetRiskAmount: number;
  actualRiskPercent: number;
  targetRiskPercent: number;
  minLot: number;
  minLotApplied: boolean;
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
    const riskAmount = risk ? lots * risk.riskPerLot : 0;
    return {
      lots,
      riskAmount,
      targetRiskAmount: riskAmount,
      actualRiskPercent:
        input.accountBalance > 0 ? (riskAmount / input.accountBalance) * 100 : 0,
      targetRiskPercent:
        input.accountBalance > 0 ? (riskAmount / input.accountBalance) * 100 : 0,
      minLot: brokerMinLots(),
      minLotApplied: false,
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

  const targetRiskAmount = input.accountBalance * (riskPercent / 100);
  const rawLots = targetRiskAmount / riskPerLot;
  const minLot = brokerMinLots(spec.lotStep);
  const minLotApplied = rawLots > 0 && rawLots < minLot;
  const lots = minLotApplied ? minLot : snapLots(rawLots, spec.lotStep);
  if (lots <= 0) return null;
  const riskAmount = lots * riskPerLot;
  return {
    lots,
    riskAmount,
    targetRiskAmount,
    actualRiskPercent: (riskAmount / input.accountBalance) * 100,
    targetRiskPercent: riskPercent,
    minLot,
    minLotApplied,
    stopDistance: priceRisk,
    stopPips: priceRisk / spec.pipSize,
    pipValuePerLot: perUnit.value * spec.pipSize,
  };
}

export function formatRiskPercent(value: number) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${rounded}%`;
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
  if (Math.abs(value * 100 - Math.round(value * 100)) < 1e-8) {
    return value.toFixed(2);
  }
  return value.toFixed(4);
}

export function formatPrice(value: number | null, digits = 5): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(2);
  if (Math.abs(value) >= 10) return value.toFixed(3);
  return value.toFixed(digits);
}
