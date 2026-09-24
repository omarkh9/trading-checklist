import {
  ASSET_CLASS_LABELS,
  resolveAsset,
  type AssetSpec,
} from "@/lib/trades/assets";
import type { Direction } from "@/lib/types/trade";

export type ConversionAccuracy = "exact" | "approximate";

export type UsdPerPriceUnit = {
  value: number;
  accuracy: ConversionAccuracy;
  quoteToUsd: number;
};

export type TradeValueInput = {
  pair: string;
  entryPrice: number;
  quoteToUsd?: number | null;
};

/**
 * USD value of a 1.00-lot move of 1.00 in price.
 *
 * quote-is-usd: contractSize
 * base-is-usd:  contractSize / price   (USDJPY, USDCAD, …)
 * quote-to-usd: contractSize * quoteToUsdRate
 */
export function snapLots(lots: number, lotStep = 0.01): number {
  if (!Number.isFinite(lots) || lots <= 0) return 0;
  const step = lotStep > 0 ? lotStep : 0.01;
  const decimals = Math.min(6, (String(step).split(".")[1] ?? "").length);
  return Number((Math.round(lots / step) * step).toFixed(Math.max(decimals, 2)));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function usdValuePerPriceUnit(
  spec: AssetSpec,
  referencePrice: number,
  quoteToUsd?: number | null
): UsdPerPriceUnit | null {
  switch (spec.usdConversion) {
    case "quote-is-usd":
      return { value: spec.contractSize, accuracy: "exact", quoteToUsd: 1 };
    case "base-is-usd": {
      if (!Number.isFinite(referencePrice) || referencePrice <= 0) return null;
      return {
        value: spec.contractSize / referencePrice,
        accuracy: "exact",
        quoteToUsd: 1 / referencePrice,
      };
    }
    case "quote-to-usd": {
      const liveRate =
        quoteToUsd != null && Number.isFinite(quoteToUsd) && quoteToUsd > 0
          ? quoteToUsd
          : null;
      const rate = liveRate ?? spec.fallbackQuoteToUsd;
      if (rate == null || rate <= 0) return null;
      return {
        value: spec.contractSize * rate,
        accuracy: liveRate != null ? "exact" : "approximate",
        quoteToUsd: rate,
      };
    }
  }
}

function conversionPrice(
  spec: AssetSpec,
  entryPrice: number,
  exitPrice?: number | null
): number {
  if (
    spec.usdConversion === "base-is-usd" &&
    exitPrice != null &&
    Number.isFinite(exitPrice) &&
    exitPrice > 0
  ) {
    return exitPrice;
  }
  return entryPrice;
}

export function priceToPips(spec: AssetSpec, priceDistance: number): number {
  return priceDistance / spec.pipSize;
}

export function pipValueUsd(
  spec: AssetSpec,
  referencePrice: number,
  quoteToUsd?: number | null
): UsdPerPriceUnit | null {
  const perUnit = usdValuePerPriceUnit(spec, referencePrice, quoteToUsd);
  if (!perUnit) return null;
  return {
    ...perUnit,
    value: perUnit.value * spec.pipSize,
  };
}

export function isShortDirection(direction: string | null | undefined): boolean {
  const value = String(direction ?? "").trim().toLowerCase();
  return value === "short" || value === "sell" || value === "s";
}

/**
 * Price change that is profitable when positive.
 * Long: exit − entry. Short: entry − exit.
 */
export function signedPriceMove(
  direction: Direction | string | null | undefined,
  entryPrice: number,
  exitPrice: number
): number {
  const move = exitPrice - entryPrice;
  return isShortDirection(direction) ? -move : move;
}

export function calculatePnlFromPrices(input: {
  pair: string;
  direction: Direction | string;
  entryPrice: number;
  exitPrice: number;
  lots: number;
  quoteToUsd?: number | null;
}): { pnlUsd: number; accuracy: ConversionAccuracy } | null {
  const { spec } = resolveAsset(input.pair);
  const lots = snapLots(input.lots, spec.lotStep);
  const perUnit = usdValuePerPriceUnit(
    spec,
    conversionPrice(spec, input.entryPrice, input.exitPrice),
    input.quoteToUsd
  );
  if (!perUnit || lots <= 0) return null;

  const signedMove = signedPriceMove(
    input.direction,
    input.entryPrice,
    input.exitPrice
  );

  return {
    pnlUsd: roundMoney(lots * signedMove * perUnit.value),
    accuracy: perUnit.accuracy,
  };
}

export type PositionRisk = {
  spec: AssetSpec;
  recognized: boolean;
  classLabel: string;
  conversionAccuracy: ConversionAccuracy;
  stopDistance: number;
  targetDistance: number | null;
  stopPips: number;
  targetPips: number | null;
  pipValuePerLotUsd: number;
  riskPerLotUsd: number;
  rewardPerLotUsd: number | null;
};

export function analyzePositionRisk(input: {
  pair: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number | null;
  quoteToUsd?: number | null;
}): PositionRisk | null {
  const { spec, recognized } = resolveAsset(input.pair);
  const stopDistance = Math.abs(input.entryPrice - input.stopLoss);
  if (!Number.isFinite(stopDistance) || stopDistance <= 0) return null;

  const perUnit = usdValuePerPriceUnit(
    spec,
    input.entryPrice,
    input.quoteToUsd
  );
  if (!perUnit) return null;

  const targetDistance =
    input.takeProfit != null && Number.isFinite(input.takeProfit)
      ? Math.abs(input.takeProfit - input.entryPrice)
      : null;

  return {
    spec,
    recognized,
    classLabel: ASSET_CLASS_LABELS[spec.assetClass],
    conversionAccuracy: perUnit.accuracy,
    stopDistance,
    targetDistance: targetDistance != null && targetDistance > 0 ? targetDistance : null,
    stopPips: priceToPips(spec, stopDistance),
    targetPips:
      targetDistance != null && targetDistance > 0
        ? priceToPips(spec, targetDistance)
        : null,
    pipValuePerLotUsd: perUnit.value * spec.pipSize,
    riskPerLotUsd: stopDistance * perUnit.value,
    rewardPerLotUsd:
      targetDistance != null && targetDistance > 0
        ? targetDistance * perUnit.value
        : null,
  };
}

export function formatPips(value: number, spec: AssetSpec): string {
  if (!Number.isFinite(value)) return "—";
  if (spec.pipSize >= 1) return value.toFixed(1);
  if (value >= 100) return value.toFixed(1);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatUsdCompact(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
