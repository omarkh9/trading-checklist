import {
  isForexWeekendClosed,
  isSessionActive,
  MARKET_SESSIONS,
  type SessionId,
} from "@/lib/markets/sessions";
import { formatCompactPnl } from "@/lib/trades/day-stats";
import { isEarlyExit } from "@/lib/trades/execution-variance";
import { parseNumericInput, sumTradePnl } from "@/lib/trades/pnl";
import type { Direction, Trade } from "@/lib/types/trade";

const RISK_CAP_PERCENT = 2;
const MIN_LEAK_TRADES = 2;

export type WinRateSlice = {
  id: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  netPnl: number;
};

export type SessionPerformance = WinRateSlice & {
  isLeak: boolean;
};

export type DisciplineGrade = "A" | "B" | "C" | "D" | "F" | "—";

export type RiskDiscipline = {
  score: number | null;
  grade: DisciplineGrade;
  avgRiskPercent: number | null;
  riskCapRate: number | null;
  stopDefinedRate: number | null;
  avgRuleScore: number | null;
  checklistRate: number | null;
  earlyExitRate: number | null;
  overRiskTrades: number;
  missingStopTrades: number;
  notes: string[];
};

export type AdvancedAnalyticsReport = {
  tradeCount: number;
  overall: WinRateSlice;
  byDirection: WinRateSlice[];
  sessions: SessionPerformance[];
  primaryLeak: SessionPerformance | null;
  discipline: RiskDiscipline;
};

type SessionBucketId = SessionId | "overlap" | "off";

const SESSION_LABELS: Record<SessionBucketId, string> = {
  sydney: "Asia / Sydney",
  tokyo: "Asia / Tokyo",
  london: "London",
  newyork: "New York",
  overlap: "London–NY overlap",
  off: "Off session",
};

const SESSION_ORDER: SessionBucketId[] = [
  "sydney",
  "tokyo",
  "london",
  "newyork",
  "overlap",
  "off",
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sliceFromTrades(id: string, label: string, trades: Trade[]): WinRateSlice {
  const wins = trades.filter((trade) => trade.outcome === "Win").length;
  const losses = trades.filter((trade) => trade.outcome === "Loss").length;
  const breakevens = trades.filter((trade) => trade.outcome === "Breakeven").length;
  return {
    id,
    label,
    trades: trades.length,
    wins,
    losses,
    breakevens,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : null,
    netPnl: sumTradePnl(trades),
  };
}

function sessionBucketsForTrade(trade: Trade): SessionBucketId[] {
  const at = new Date(trade.createdAt);
  if (Number.isNaN(at.getTime()) || isForexWeekendClosed(at)) return ["off"];

  const active = MARKET_SESSIONS.filter((session) => isSessionActive(at, session));
  if (active.length === 0) return ["off"];

  const ids = active.map((session) => session.id);
  const buckets: SessionBucketId[] = [...ids];
  if (ids.includes("london") && ids.includes("newyork")) {
    buckets.push("overlap");
  }
  return buckets;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values) ?? 0;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function gradeFromScore(score: number | null): DisciplineGrade {
  if (score == null) return "—";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function computeRiskDiscipline(trades: Trade[]): RiskDiscipline {
  if (trades.length === 0) {
    return {
      score: null,
      grade: "—",
      avgRiskPercent: null,
      riskCapRate: null,
      stopDefinedRate: null,
      avgRuleScore: null,
      checklistRate: null,
      earlyExitRate: null,
      overRiskTrades: 0,
      missingStopTrades: 0,
      notes: ["Log trades to score risk discipline."],
    };
  }

  const risks = trades
    .map((trade) => parseNumericInput(trade.riskPercent))
    .filter((value): value is number => value != null && value > 0);
  const avgRiskPercent = mean(risks);
  const overRiskTrades = risks.filter((value) => value > RISK_CAP_PERCENT).length;
  const riskCapRate =
    risks.length > 0
      ? ((risks.length - overRiskTrades) / risks.length) * 100
      : null;

  const missingStopTrades = trades.filter((trade) => !trade.stopLoss.trim()).length;
  const stopDefinedRate =
    ((trades.length - missingStopTrades) / trades.length) * 100;

  const ruleScores = trades
    .map((trade) => trade.ruleScore)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const avgRuleScore = mean(ruleScores);

  const checklistRate =
    (trades.filter((trade) => trade.checkedRuleIds.length > 0).length /
      trades.length) *
    100;

  const measuredWins = trades.filter(
    (trade) =>
      trade.outcome === "Win" &&
      parseNumericInput(trade.exitPrice) != null &&
      parseNumericInput(trade.takeProfit) != null
  );
  const earlyExits = measuredWins.filter((trade) => isEarlyExit(trade)).length;
  const earlyExitRate =
    measuredWins.length > 0 ? (earlyExits / measuredWins.length) * 100 : null;

  let weighted = 0;
  let totalWeight = 0;
  const add = (value: number, weight: number) => {
    weighted += value * weight;
    totalWeight += weight;
  };

  if (risks.length >= 2 && avgRiskPercent != null && avgRiskPercent > 0) {
    const cv = stdev(risks) / avgRiskPercent;
    add(clampScore(100 - cv * 80), 25);
  } else if (risks.length === 1) {
    add(88, 12);
  }

  if (riskCapRate != null) add(riskCapRate, 20);
  add(stopDefinedRate, 20);
  if (avgRuleScore != null) add(avgRuleScore, 20);
  add(checklistRate, 10);
  if (earlyExitRate != null) add(100 - earlyExitRate, 15);

  const score = totalWeight > 0 ? clampScore(weighted / totalWeight) : null;
  const notes: string[] = [];

  if (avgRiskPercent != null) {
    notes.push(
      overRiskTrades > 0
        ? `Average risk ${avgRiskPercent.toFixed(2)}% · ${overRiskTrades} trade${overRiskTrades === 1 ? "" : "s"} above ${RISK_CAP_PERCENT}%.`
        : `Average risk ${avgRiskPercent.toFixed(2)}% · every sized trade stayed at or under ${RISK_CAP_PERCENT}%.`
    );
  } else {
    notes.push("Risk percent is missing on this sample — size is hard to audit.");
  }

  if (missingStopTrades > 0) {
    notes.push(
      `${missingStopTrades} trade${missingStopTrades === 1 ? "" : "s"} logged without a stop.`
    );
  } else {
    notes.push("Every trade in this sample has a stop defined.");
  }

  if (avgRuleScore != null) {
    notes.push(`Average rule score ${Math.round(avgRuleScore)}%.`);
  }
  if (earlyExitRate != null) {
    notes.push(
      earlyExits > 0
        ? `Left ${earlyExits} of ${measuredWins.length} measurable winners before TP.`
        : `Held all ${measuredWins.length} measurable winners to the planned TP.`
    );
  }

  return {
    score,
    grade: gradeFromScore(score),
    avgRiskPercent,
    riskCapRate,
    stopDefinedRate,
    avgRuleScore,
    checklistRate,
    earlyExitRate,
    overRiskTrades,
    missingStopTrades,
    notes,
  };
}

export function computeAdvancedAnalytics(trades: Trade[]): AdvancedAnalyticsReport {
  const overall = sliceFromTrades("all", "All trades", trades);
  const byDirection: WinRateSlice[] = (["Long", "Short"] as Direction[]).map(
    (direction) =>
      sliceFromTrades(
        direction.toLowerCase(),
        direction,
        trades.filter((trade) => trade.direction === direction)
      )
  );

  const grouped = new Map<SessionBucketId, Trade[]>();
  for (const id of SESSION_ORDER) grouped.set(id, []);
  for (const trade of trades) {
    for (const bucket of sessionBucketsForTrade(trade)) {
      grouped.get(bucket)?.push(trade);
    }
  }

  const sessions: SessionPerformance[] = SESSION_ORDER.map((id) => ({
    ...sliceFromTrades(id, SESSION_LABELS[id], grouped.get(id) ?? []),
    isLeak: false,
  }));

  const candidates = sessions.filter((row) => row.trades >= MIN_LEAK_TRADES);
  const primaryLeak =
    candidates.length > 0
      ? [...candidates].sort((a, b) => {
          if (a.netPnl !== b.netPnl) return a.netPnl - b.netPnl;
          return (a.winRate ?? 100) - (b.winRate ?? 100);
        })[0]
      : null;

  const marked = sessions.map((row) => ({
    ...row,
    isLeak: Boolean(
      primaryLeak &&
        row.id === primaryLeak.id &&
        (primaryLeak.netPnl < 0 || (primaryLeak.winRate ?? 100) < 45)
    ),
  }));

  return {
    tradeCount: trades.length,
    overall,
    byDirection,
    sessions: marked,
    primaryLeak: marked.find((row) => row.isLeak) ?? null,
    discipline: computeRiskDiscipline(trades),
  };
}

function money(value: number) {
  if (value > 0) return `+${formatCompactPnl(value)}`;
  return formatCompactPnl(value);
}

function wr(value: number | null) {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export function formatAdvancedAnalyticsContext(report: AdvancedAnalyticsReport): string {
  const direction = report.byDirection
    .map(
      (row) =>
        `${row.label}: ${row.trades} trades, ${wr(row.winRate)} WR, ${money(row.netPnl)}`
    )
    .join("; ");

  const sessions = report.sessions
    .filter((row) => row.trades > 0)
    .map((row) => {
      const leak = row.isLeak ? " [SESSION LEAK]" : "";
      return `- ${row.label}: ${row.trades} trades, ${wr(row.winRate)} WR, ${money(row.netPnl)}${leak}`;
    })
    .join("\n");

  const discipline = report.discipline;
  return [
    `Journal sample: ${report.tradeCount} trades.`,
    `Win rate: ${wr(report.overall.winRate)} (${report.overall.wins}W / ${report.overall.losses}L / ${report.overall.breakevens} BE). Net P/L: ${money(report.overall.netPnl)}.`,
    direction ? `By direction: ${direction}.` : null,
    sessions ? `Session performance:\n${sessions}` : "Session performance: no timestamped trades.",
    report.primaryLeak
      ? `Primary session leak: ${report.primaryLeak.label} (${wr(report.primaryLeak.winRate)} WR, ${money(report.primaryLeak.netPnl)}).`
      : "No session leak flagged (sample too small or every session is holding).",
    `Risk discipline score: ${discipline.score ?? "—"} (${discipline.grade}).`,
    discipline.notes.map((note) => `- ${note}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}
