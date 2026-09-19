import { CALENDAR_METRIC_STORAGE_KEY } from "@/lib/storage/keys";
import { sumTradePnl } from "@/lib/trades/pnl";
import { tradeDateKey } from "@/lib/trades/load-trades";
import type { Trade } from "@/lib/types/trade";

export type CalendarDisplayMetric = "dollar" | "percent";
export type DayTone = "positive" | "negative" | "breakeven";

export type DayStats = {
  tradeCount: number;
  wins: number;
  winRate: number;
  netPnl: number;
  returnPct: number | null;
  tone: DayTone;
};

const BREAKEVEN_EPS = 0.005;

export function dayToneFromPnl(netPnl: number): DayTone {
  if (netPnl > BREAKEVEN_EPS) return "positive";
  if (netPnl < -BREAKEVEN_EPS) return "negative";
  return "breakeven";
}

export function computeDayStats(
  dayTrades: Trade[],
  startingEquity: number
): DayStats {
  const netPnl = sumTradePnl(dayTrades);
  const wins = dayTrades.filter((trade) => trade.outcome === "Win").length;
  const tradeCount = dayTrades.length;
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;

  let basis = startingEquity;
  if (!(basis > 0) && tradeCount > 0) {
    const first = [...dayTrades].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    basis = first.accountBalanceAtEntry;
  }

  return {
    tradeCount,
    wins,
    winRate,
    netPnl,
    returnPct: basis > 0 ? (netPnl / basis) * 100 : null,
    tone: dayToneFromPnl(netPnl),
  };
}

export function buildStartingEquityByDay(
  tradesByDay: Map<string, Trade[]>,
  startingBalance: number
): Map<string, number> {
  const days = [...tradesByDay.keys()].sort();
  const equityByDay = new Map<string, number>();
  let running = startingBalance;

  for (const day of days) {
    equityByDay.set(day, running);
    running += sumTradePnl(tradesByDay.get(day) ?? []);
  }

  return equityByDay;
}

export function startingEquityForDay(
  dayTrades: Trade[],
  dateKey: string,
  equityByDay: Map<string, number>,
  startingBalance: number
): number {
  const fromLedger = equityByDay.get(dateKey);
  if (fromLedger != null && fromLedger > 0) return fromLedger;

  if (dayTrades.length > 0) {
    const first = [...dayTrades].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    if (first.accountBalanceAtEntry > 0) return first.accountBalanceAtEntry;
  }

  return startingBalance;
}

export function formatCompactPnl(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  }
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatReturnPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatWinRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTradeCount(count: number): string {
  return `${count} ${count === 1 ? "trade" : "trades"}`;
}

export function formatDayMetric(
  stats: DayStats,
  metric: CalendarDisplayMetric
): string {
  return metric === "percent"
    ? formatReturnPct(stats.returnPct)
    : formatCompactPnl(stats.netPnl);
}

export function loadCalendarDisplayMetric(): CalendarDisplayMetric {
  if (typeof window === "undefined") return "dollar";
  try {
    const raw = localStorage.getItem(CALENDAR_METRIC_STORAGE_KEY);
    return raw === "percent" ? "percent" : "dollar";
  } catch {
    return "dollar";
  }
}

export function saveCalendarDisplayMetric(metric: CalendarDisplayMetric): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALENDAR_METRIC_STORAGE_KEY, metric);
}

export function groupTradesByDay(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = tradeDateKey(trade.createdAt);
    const list = map.get(key) ?? [];
    list.push(trade);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  return map;
}
