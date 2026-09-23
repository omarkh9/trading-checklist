import { parseNumericDraft } from "@/lib/forms/numeric-input";
import { calculatePnlFromPrices, roundMoney } from "@/lib/trades/contract-math";
import type { Direction, Outcome, PnlMode, Trade } from "@/lib/types/trade";

export function parseNumericInput(value: string): number | null {
  return parseNumericDraft(value);
}

export function outcomeFromPnl(value: number): Outcome {
  if (value > 0.005) return "Win";
  if (value < -0.005) return "Loss";
  return "Breakeven";
}

export function resolvePnlDollars(
  outcome: Outcome,
  pnlMode: PnlMode,
  pnlInput: string,
  balanceBeforeTrade: number
): number {
  if (outcome === "Breakeven") return 0;

  const raw = parseNumericInput(pnlInput);
  if (raw === null || raw <= 0) return 0;

  const magnitude =
    pnlMode === "percent"
      ? balanceBeforeTrade * (raw / 100)
      : raw;

  return roundMoney(outcome === "Loss" ? -magnitude : magnitude);
}

export function formatPnlDollars(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sumTradePnl(trades: Trade[]): number {
  return trades.reduce((sum, trade) => sum + (trade.pnlDollars ?? 0), 0);
}

export function estimatePnlFromPrices(input: {
  pair: string;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  lots: number | null;
  quoteToUsd?: number | null;
}): number | null {
  const entry = parseNumericInput(input.entryPrice);
  const exit = parseNumericInput(input.exitPrice);
  if (entry === null || exit === null || input.lots === null || input.lots <= 0) {
    return null;
  }

  const computed = calculatePnlFromPrices({
    pair: input.pair,
    direction: input.direction,
    entryPrice: entry,
    exitPrice: exit,
    lots: input.lots,
    quoteToUsd: input.quoteToUsd,
  });

  return computed?.pnlUsd ?? null;
}

export function resolveLotsForPnl(input: {
  lotSize: string;
  fixedLotSize: string;
  calculatedLot: number | null;
}): number | null {
  return (
    parseNumericInput(input.lotSize) ??
    parseNumericInput(input.fixedLotSize) ??
    input.calculatedLot
  );
}

export function resolveExitPrice(
  exitPrice: string,
  takeProfit: string,
  stopLoss = "",
  outcome?: Outcome
): string {
  const exit = exitPrice.trim();
  if (exit) return exit;

  const stop = stopLoss.trim();
  const target = takeProfit.trim();

  if (outcome === "Loss") return stop;
  if (outcome === "Win") return target;
  if (outcome === "Breakeven") return "";
  return target || stop;
}

function signedFallbackPnl(
  outcome: Outcome,
  fallbackLossUsd?: number | null,
  fallbackWinUsd?: number | null
): number | null {
  if (outcome === "Loss" && fallbackLossUsd != null && fallbackLossUsd > 0) {
    return -roundMoney(fallbackLossUsd);
  }
  if (outcome === "Win" && fallbackWinUsd != null && fallbackWinUsd > 0) {
    return roundMoney(fallbackWinUsd);
  }
  if (outcome === "Breakeven") return 0;
  return null;
}

export function resolveTradeResult(input: {
  pair: string;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  lots: number | null;
  quoteToUsd?: number | null;
  outcome: Outcome;
  pnlMode: PnlMode;
  pnlInput: string;
  balanceBeforeTrade: number;
  preferAuto?: boolean;
  hasExplicitExit?: boolean;
  fallbackLossUsd?: number | null;
  fallbackWinUsd?: number | null;
}): { pnlDollars: number; outcome: Outcome; autoCalculated: boolean } {
  if (input.preferAuto !== false && input.outcome === "Breakeven" && !input.hasExplicitExit) {
    return { pnlDollars: 0, outcome: "Breakeven", autoCalculated: true };
  }

  const autoPnl =
    input.preferAuto === false
      ? null
      : estimatePnlFromPrices({
          pair: input.pair,
          direction: input.direction,
          entryPrice: input.entryPrice,
          exitPrice: input.exitPrice,
          lots: input.lots,
          quoteToUsd: input.quoteToUsd,
        });

  if (autoPnl != null) {
    if (!input.hasExplicitExit && input.outcome === "Loss") {
      return {
        pnlDollars: -Math.abs(autoPnl),
        outcome: "Loss",
        autoCalculated: true,
      };
    }
    if (!input.hasExplicitExit && input.outcome === "Win") {
      return {
        pnlDollars: Math.abs(autoPnl),
        outcome: "Win",
        autoCalculated: true,
      };
    }
    return {
      pnlDollars: autoPnl,
      outcome: outcomeFromPnl(autoPnl),
      autoCalculated: true,
    };
  }

  if (input.preferAuto !== false) {
    const fallback = signedFallbackPnl(
      input.outcome,
      input.fallbackLossUsd,
      input.fallbackWinUsd
    );
    if (fallback != null) {
      return {
        pnlDollars: fallback,
        outcome: input.outcome,
        autoCalculated: true,
      };
    }
  }

  return {
    pnlDollars: resolvePnlDollars(
      input.outcome,
      input.pnlMode,
      input.pnlInput,
      input.balanceBeforeTrade
    ),
    outcome: input.outcome,
    autoCalculated: false,
  };
}
