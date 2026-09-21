import { calculatePnlFromPrices } from "@/lib/trades/contract-math";
import type { Direction, Outcome, PnlMode, Trade } from "@/lib/types/trade";

export function parseNumericInput(value: string): number | null {
  const parsed = parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

  return outcome === "Loss" ? -magnitude : magnitude;
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
}): number | null {
  const entry = parseNumericInput(input.entryPrice);
  const exit = parseNumericInput(input.exitPrice);
  if (entry === null || exit === null || input.lots === null || input.lots <= 0) {
    return null;
  }

  return (
    calculatePnlFromPrices({
      pair: input.pair,
      direction: input.direction,
      entryPrice: entry,
      exitPrice: exit,
      lots: input.lots,
    })?.pnlUsd ?? null
  );
}

export function resolveTradeResult(input: {
  pair: string;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  lots: number | null;
  outcome: Outcome;
  pnlMode: PnlMode;
  pnlInput: string;
  balanceBeforeTrade: number;
  preferAuto?: boolean;
}): { pnlDollars: number; outcome: Outcome; autoCalculated: boolean } {
  const autoPnl =
    input.preferAuto === false
      ? null
      : estimatePnlFromPrices({
          pair: input.pair,
          direction: input.direction,
          entryPrice: input.entryPrice,
          exitPrice: input.exitPrice,
          lots: input.lots,
        });

  if (autoPnl != null) {
    return {
      pnlDollars: autoPnl,
      outcome: outcomeFromPnl(autoPnl),
      autoCalculated: true,
    };
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
