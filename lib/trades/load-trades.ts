import type { Trade } from "@/lib/types/trade";
import { dateKeyFromDate as localDateKeyFromDate, zonedDateKey } from "@/lib/time";

function toChartImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:image") ? value : null;
}

export function normalizeTrade(trade: Trade): Trade {
  return {
    ...trade,
    higherTimeFrame: toChartImage(trade.higherTimeFrame),
    middleTimeFrame: toChartImage(trade.middleTimeFrame),
    lowerTimeFrame: toChartImage(trade.lowerTimeFrame),
    entry: toChartImage(trade.entry),
    pnlMode: trade.pnlMode ?? "dollar",
    pnlInput: trade.pnlInput ?? "",
    pnlDollars: typeof trade.pnlDollars === "number" ? trade.pnlDollars : 0,
    riskSizeMode: trade.riskSizeMode ?? "percent",
    riskPercent: trade.riskPercent ?? "1",
    fixedLotSize: trade.fixedLotSize ?? "",
    lotSize: trade.lotSize ?? "",
    strategy: trade.strategy ?? "",
    accountBalanceAtEntry:
      typeof trade.accountBalanceAtEntry === "number"
        ? trade.accountBalanceAtEntry
        : 0,
  };
}

export function tradeDateKey(iso: string): string {
  return zonedDateKey(iso);
}

export function dateKeyFromDate(date: Date): string {
  return localDateKeyFromDate(date);
}
