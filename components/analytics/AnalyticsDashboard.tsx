"use client";

import { fetchTrades } from "@/lib/supabase/trades";
import {
  buildEquityCurve,
  computeAnalyticsSummary,
  computeStrategyPerformance,
  formatRatio,
  formatSignedCompactPnl,
  type EquityPoint,
  type StrategyPerformance,
} from "@/lib/trades/analytics";
import { formatCompactPnl, formatWinRate } from "@/lib/trades/day-stats";
import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Trade } from "@/lib/types/trade";
import {
  ArrowDownRight,
  DollarSign,
  Scale,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  tone?: "positive" | "negative" | "neutral";
  isEmpty?: boolean;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  isEmpty,
}: StatCardProps) {
  const valueClass = isEmpty
    ? "text-zinc-600"
    : tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-zinc-100";

  return (
    <div
      className={`rounded-xl border bg-surface-raised p-5 ${
        isEmpty ? "border-dashed border-border" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isEmpty ? "bg-surface-overlay" : "bg-accent/10"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${isEmpty ? "text-zinc-600" : "text-accent"}`}
          />
        </div>
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-surface-overlay/50">
      <p className="px-4 text-center text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function EquityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EquityPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  if (point.tradeNumber === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-zinc-300 shadow-xl">
        Starting equity · $0.00
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-zinc-300 shadow-xl">
      <p className="font-medium text-zinc-100">
        {point.pair} · Trade {point.tradeNumber}
      </p>
      <p className="mt-1 text-zinc-400">{point.label}</p>
      <p className="mt-1">Trade P/L {formatPnlDollars(point.pnl)}</p>
      <p>Cumulative {formatPnlDollars(point.cumulative)}</p>
    </div>
  );
}

function StrategyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: StrategyPerformance }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-zinc-300 shadow-xl">
      <p className="font-medium text-zinc-100">{row.name}</p>
      <p className="mt-1">{formatWinRate(row.winRate)} win rate</p>
      <p>
        {row.trades} trades · {row.wins}W / {row.losses}L
      </p>
      <p>Net {formatSignedCompactPnl(row.netPnl)}</p>
      <p>Profit factor {formatRatio(row.profitFactor)}</p>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextTrades = await fetchTrades();
        if (!cancelled) {
          setTrades(nextTrades);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTrades([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load trades."
          );
        }
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => computeAnalyticsSummary(trades), [trades]);
  const strategies = useMemo(
    () => computeStrategyPerformance(trades),
    [trades]
  );
  const equityCurve = useMemo(() => {
    const points = buildEquityCurve(trades);
    if (points.length === 0) return [];
    return [
      {
        ...points[0],
        tradeId: "start",
        pair: "",
        tradeNumber: 0,
        pnl: 0,
        cumulative: 0,
        label: "Start",
      },
      ...points,
    ];
  }, [trades]);

  const hasTrades = trades.length > 0;
  const lastEquity = equityCurve.at(-1)?.cumulative ?? 0;

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-raised" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-xl bg-surface-raised" />
          <div className="h-80 rounded-xl bg-surface-raised" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Net Profit"
          value={hasTrades ? formatSignedCompactPnl(summary.totalNetProfit) : "—"}
          hint={
            hasTrades
              ? `${summary.tradeCount} closed trades`
              : "Log trades to calculate"
          }
          icon={DollarSign}
          tone={
            summary.totalNetProfit > 0
              ? "positive"
              : summary.totalNetProfit < 0
                ? "negative"
                : "neutral"
          }
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Profit Factor"
          value={hasTrades ? formatRatio(summary.profitFactor) : "—"}
          hint={
            hasTrades
              ? "Gross profit ÷ gross loss"
              : "Needs winning and losing trades"
          }
          icon={Scale}
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Win / Loss Ratio"
          value={hasTrades ? formatRatio(summary.winLossRatio) : "—"}
          hint={
            hasTrades
              ? `${summary.wins}W / ${summary.losses}L · ${summary.breakevens} BE`
              : "Wins divided by losses"
          }
          icon={TrendingUp}
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Maximum Drawdown"
          value={hasTrades ? formatCompactPnl(summary.maxDrawdown) : "—"}
          hint={
            hasTrades && summary.maxDrawdownPct != null
              ? `${summary.maxDrawdownPct.toFixed(1)}% off peak equity`
              : hasTrades
                ? "Peak-to-trough on the equity curve"
                : "Measured from cumulative P/L"
          }
          icon={ArrowDownRight}
          tone={summary.maxDrawdown > 0 ? "negative" : "neutral"}
          isEmpty={!hasTrades}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface-raised p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                Performance by Setup
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Win rate, trade count, and net P/L by strategy tag
              </p>
            </div>
          </div>

          {strategies.length === 0 ? (
            <div className="mt-6">
              <ChartEmpty message="Log trades with a strategy or a #tag in notes to see setup performance." />
            </div>
          ) : (
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={strategies}
                  margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
                >
                  <CartesianGrid stroke="#2a2a3a" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a3a" }}
                    interval={0}
                    angle={strategies.length > 4 ? -25 : 0}
                    textAnchor={strategies.length > 4 ? "end" : "middle"}
                    height={strategies.length > 4 ? 48 : 28}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => `${value}%`}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={<StrategyTooltip />}
                  />
                  <Bar dataKey="winRate" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {strategies.map((row) => (
                      <Cell
                        key={row.name}
                        fill={
                          row.netPnl > 0
                            ? "#34d399"
                            : row.netPnl < 0
                              ? "#fb7185"
                              : "#818cf8"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {strategies.length > 0 && (
            <ul className="mt-4 space-y-2">
              {strategies.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 text-xs text-zinc-400"
                >
                  <span className="font-medium text-zinc-200">{row.name}</span>
                  <span className="tabular-nums">
                    {formatWinRate(row.winRate)} · {row.trades}{" "}
                    {row.trades === 1 ? "trade" : "trades"} ·{" "}
                    <span
                      className={
                        row.netPnl > 0
                          ? "text-emerald-300"
                          : row.netPnl < 0
                            ? "text-rose-300"
                            : "text-zinc-400"
                      }
                    >
                      {formatSignedCompactPnl(row.netPnl)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface-raised p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                Cumulative P&amp;L
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Equity curve of net profit over time
              </p>
            </div>
            {hasTrades && (
              <p
                className={`font-mono text-sm font-semibold ${
                  lastEquity > 0
                    ? "text-emerald-300"
                    : lastEquity < 0
                      ? "text-rose-300"
                      : "text-zinc-400"
                }`}
              >
                {formatPnlDollars(lastEquity)}
              </p>
            )}
          </div>

          {!hasTrades ? (
            <div className="mt-6">
              <ChartEmpty message="Your cumulative P/L curve will appear after the first journaled trade." />
            </div>
          ) : (
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={equityCurve}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2a2a3a" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a3a" }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => formatCompactPnl(value)}
                    width={56}
                  />
                  <Tooltip content={<EquityTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fill="url(#equityFill)"
                    dot={equityCurve.length < 8}
                    activeDot={{ r: 5, fill: "#c7d2fe" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
