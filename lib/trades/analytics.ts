import { formatCompactPnl } from "@/lib/trades/day-stats";
import { formatLocalDateShort, timestampMs } from "@/lib/time";
import { sumTradePnl } from "@/lib/trades/pnl";
import type { Trade } from "@/lib/types/trade";

export type EquityPoint = {
  tradeId: string;
  pair: string;
  at: string;
  label: string;
  tradeNumber: number;
  pnl: number;
  cumulative: number;
};

export type StrategyPerformance = {
  name: string;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnl: number;
  profitFactor: number | null;
};

export type AnalyticsSummary = {
  tradeCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  totalNetProfit: number;
  profitFactor: number | null;
  winLossRatio: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number | null;
};

const UNTAGGED = "Untagged";

function chronologicalTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const delta =
      timestampMs(a.createdAt) - timestampMs(b.createdAt);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

function titleCaseTag(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function tagsFromNotes(notes: string): string[] {
  const matches = notes.matchAll(/#([A-Za-z0-9][A-Za-z0-9_-]*)/g);
  const tags: string[] = [];
  for (const match of matches) {
    const tag = titleCaseTag(match[1]);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function strategyTagsForTrade(trade: Trade): string[] {
  const tags = tagsFromNotes(trade.notes);
  const named = titleCaseTag(trade.strategy ?? "");
  if (named && !tags.includes(named)) tags.unshift(named);
  return tags.length > 0 ? tags : [UNTAGGED];
}

export function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  let cumulative = 0;
  return chronologicalTrades(trades).map((trade, index) => {
    cumulative += trade.pnlDollars ?? 0;
    return {
      tradeId: trade.id,
      pair: trade.pair,
      at: trade.createdAt,
      label: formatLocalDateShort(trade.createdAt),
      tradeNumber: index + 1,
      pnl: trade.pnlDollars ?? 0,
      cumulative,
    };
  });
}

export function computeMaxDrawdown(points: EquityPoint[]): {
  maxDrawdown: number;
  maxDrawdownPct: number | null;
} {
  let peak = 0;
  let maxDrawdown = 0;
  let peakForPct = 0;

  for (const point of points) {
    if (point.cumulative > peak) {
      peak = point.cumulative;
      if (peak > 0) peakForPct = peak;
    }
    const drawdown = peak - point.cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return {
    maxDrawdown,
    maxDrawdownPct: peakForPct > 0 ? (maxDrawdown / peakForPct) * 100 : null,
  };
}

function profitFactor(grossProfit: number, grossLoss: number): number | null {
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

export function computeAnalyticsSummary(trades: Trade[]): AnalyticsSummary {
  const ordered = chronologicalTrades(trades);
  const wins = ordered.filter((trade) => trade.outcome === "Win").length;
  const losses = ordered.filter((trade) => trade.outcome === "Loss").length;
  const breakevens = ordered.filter(
    (trade) => trade.outcome === "Breakeven"
  ).length;

  const grossProfit = ordered.reduce(
    (sum, trade) => sum + Math.max(trade.pnlDollars ?? 0, 0),
    0
  );
  const grossLoss = ordered.reduce(
    (sum, trade) => sum + Math.abs(Math.min(trade.pnlDollars ?? 0, 0)),
    0
  );

  const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(
    buildEquityCurve(ordered)
  );

  return {
    tradeCount: ordered.length,
    wins,
    losses,
    breakevens,
    totalNetProfit: sumTradePnl(ordered),
    profitFactor: profitFactor(grossProfit, grossLoss),
    winLossRatio: losses > 0 ? wins / losses : wins > 0 ? Number.POSITIVE_INFINITY : null,
    maxDrawdown,
    maxDrawdownPct,
  };
}

export function computeStrategyPerformance(
  trades: Trade[]
): StrategyPerformance[] {
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    for (const tag of strategyTagsForTrade(trade)) {
      const list = grouped.get(tag) ?? [];
      list.push(trade);
      grouped.set(tag, list);
    }
  }

  return [...grouped.entries()]
    .map(([name, tagged]) => {
      const wins = tagged.filter((trade) => trade.outcome === "Win").length;
      const losses = tagged.filter((trade) => trade.outcome === "Loss").length;
      const breakevens = tagged.filter(
        (trade) => trade.outcome === "Breakeven"
      ).length;
      const grossProfit = tagged.reduce(
        (sum, trade) => sum + Math.max(trade.pnlDollars ?? 0, 0),
        0
      );
      const grossLoss = tagged.reduce(
        (sum, trade) => sum + Math.abs(Math.min(trade.pnlDollars ?? 0, 0)),
        0
      );

      return {
        name,
        trades: tagged.length,
        wins,
        losses,
        breakevens,
        winRate: tagged.length > 0 ? (wins / tagged.length) * 100 : 0,
        netPnl: sumTradePnl(tagged),
        profitFactor: profitFactor(grossProfit, grossLoss),
      };
    })
    .sort((a, b) => b.trades - a.trades || b.netPnl - a.netPnl);
}

export function formatRatio(value: number | null): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

export function formatSignedCompactPnl(value: number): string {
  if (value > 0) return `+${formatCompactPnl(value)}`;
  if (value < 0) return formatCompactPnl(value);
  return formatCompactPnl(0);
}
