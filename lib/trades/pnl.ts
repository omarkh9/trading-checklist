import type { Outcome, PnlMode, Trade } from "@/lib/types/trade";

export function parseNumericInput(value: string): number | null {
  const parsed = parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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
