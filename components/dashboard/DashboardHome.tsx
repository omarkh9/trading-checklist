"use client";

import { useAccounts } from "@/components/accounts/AccountProvider";
import { EconomicCalendar } from "@/components/news/EconomicCalendar";
import { useCachedTrades } from "@/components/trade-journal/useCachedTrades";
import type { Outcome, Trade } from "@/lib/types/trade";
import { formatLocalDate, startOfLocalWeek, timestampMs } from "@/lib/time";
import {
  computeCurrentBalance,
  formatBalance,
  tradesForAccount,
} from "@/lib/trades/account-balance";
import { formatPnlDollars, sumTradePnl } from "@/lib/trades/pnl";
import {
  ArrowRight,
  ArrowUpRight,
  NotebookPen,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { memo, useMemo } from "react";

function computeRiskReward(trade: Trade): number | null {
  const entry = parseFloat(trade.entryPrice);
  const sl = parseFloat(trade.stopLoss);
  const tp = parseFloat(trade.takeProfit);
  if (![entry, sl, tp].every(Number.isFinite)) return null;

  const risk = trade.direction === "Long" ? entry - sl : sl - entry;
  const reward = trade.direction === "Long" ? tp - entry : entry - tp;
  if (risk <= 0 || reward <= 0) return null;

  return reward / risk;
}

type Accent = "emerald" | "rose" | "indigo" | "violet" | "amber" | "slate";

const accentStyles: Record<
  Accent,
  {
    bar: string;
    wash: string;
    border: string;
    glow: string;
    icon: string;
    iconWrap: string;
    value: string;
  }
> = {
  emerald: {
    bar: "from-emerald-400 via-teal-300 to-indigo-400",
    wash: "from-emerald-500/20 via-transparent to-indigo-500/10",
    border: "border-emerald-400/25 hover:border-emerald-300/40",
    glow: "hover:shadow-[0_0_28px_rgba(16,185,129,0.16)]",
    icon: "text-emerald-300",
    iconWrap: "bg-emerald-500/15 ring-1 ring-emerald-400/25",
    value: "text-emerald-300",
  },
  rose: {
    bar: "from-rose-500 via-red-400 to-orange-400",
    wash: "from-rose-500/20 via-transparent to-indigo-500/10",
    border: "border-rose-400/25 hover:border-rose-300/40",
    glow: "hover:shadow-[0_0_28px_rgba(244,63,94,0.16)]",
    icon: "text-rose-300",
    iconWrap: "bg-rose-500/15 ring-1 ring-rose-400/25",
    value: "text-rose-300",
  },
  indigo: {
    bar: "from-indigo-400 via-violet-400 to-fuchsia-400",
    wash: "from-indigo-500/20 via-transparent to-violet-600/10",
    border: "border-indigo-400/25 hover:border-indigo-300/45",
    glow: "hover:shadow-[0_0_28px_rgba(99,102,241,0.2)]",
    icon: "text-indigo-300",
    iconWrap: "bg-indigo-500/15 ring-1 ring-indigo-400/30",
    value: "text-indigo-200",
  },
  violet: {
    bar: "from-violet-400 via-indigo-400 to-sky-400",
    wash: "from-violet-500/18 via-transparent to-indigo-500/10",
    border: "border-violet-400/25 hover:border-violet-300/40",
    glow: "hover:shadow-[0_0_28px_rgba(139,92,246,0.18)]",
    icon: "text-violet-300",
    iconWrap: "bg-violet-500/15 ring-1 ring-violet-400/25",
    value: "text-violet-200",
  },
  amber: {
    bar: "from-amber-400 via-orange-300 to-indigo-400",
    wash: "from-amber-500/16 via-transparent to-indigo-500/10",
    border: "border-amber-400/25 hover:border-amber-300/40",
    glow: "hover:shadow-[0_0_28px_rgba(245,158,11,0.14)]",
    icon: "text-amber-300",
    iconWrap: "bg-amber-500/15 ring-1 ring-amber-400/25",
    value: "text-amber-300",
  },
  slate: {
    bar: "from-zinc-600 via-zinc-500 to-zinc-700",
    wash: "from-white/[0.03] via-transparent to-transparent",
    border: "border-dashed border-white/10",
    glow: "",
    icon: "text-zinc-600",
    iconWrap: "bg-white/5 ring-1 ring-white/10",
    value: "text-zinc-600",
  },
};

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  accent: Accent;
  isEmpty?: boolean;
};

const StatCard = memo(function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  isEmpty,
}: StatCardProps) {
  const tone = isEmpty ? "slate" : accent;
  const styles = accentStyles[tone];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-[#0c0c16]/90 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-0.5 ${styles.border} ${styles.glow}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${styles.bar}`}
      />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.wash}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </p>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${styles.iconWrap}`}
        >
          <Icon className={`h-4 w-4 ${styles.icon}`} />
        </div>
      </div>
      <p
        className={`relative mt-4 font-sans text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl ${styles.value}`}
      >
        {value}
      </p>
      <p className="relative mt-2 text-sm text-zinc-500">{hint}</p>
    </div>
  );
});

const outcomeRowClass: Record<Outcome, string> = {
  Win: "border-emerald-400/25 bg-emerald-500/[0.07] hover:border-emerald-400/40",
  Loss: "border-rose-400/25 bg-rose-500/[0.07] hover:border-rose-400/40",
  Breakeven: "border-sky-400/25 bg-sky-500/[0.07] hover:border-sky-400/40",
};

const outcomeBadgeClass: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  Loss: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  Breakeven: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
};

function winRateAccent(winRate: number | null): Accent {
  if (winRate == null) return "slate";
  if (winRate >= 55) return "emerald";
  if (winRate >= 45) return "amber";
  return "rose";
}

function rrAccent(avgRr: number | null): Accent {
  if (avgRr == null) return "slate";
  if (avgRr >= 1.5) return "emerald";
  if (avgRr >= 1) return "amber";
  return "rose";
}

function computeDashboardMetrics(trades: Trade[]) {
  const weekStartMs = startOfLocalWeek(new Date()).getTime();
  let tradesThisWeek = 0;
  let wins = 0;
  let rrSum = 0;
  let rrCount = 0;

  for (const trade of trades) {
    if (timestampMs(trade.createdAt) >= weekStartMs) tradesThisWeek += 1;
    if (trade.outcome === "Win") wins += 1;
    const rr = computeRiskReward(trade);
    if (rr != null) {
      rrSum += rr;
      rrCount += 1;
    }
  }

  return {
    tradesThisWeek,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : null,
    wins,
    avgRr: rrCount > 0 ? rrSum / rrCount : null,
    netPnl: sumTradePnl(trades),
    recentTrades: trades.slice(0, 5),
  };
}

export const DashboardHome = memo(function DashboardHome() {
  const { accounts, activeAccount, isLoaded: accountsLoaded } = useAccounts();
  const { trades: allTrades, isLoaded: tradesLoaded } = useCachedTrades();

  const fallbackId = accounts[0]?.id ?? "";
  const trades = useMemo(
    () => tradesForAccount(allTrades, activeAccount?.id ?? "", fallbackId),
    [allTrades, activeAccount?.id, fallbackId]
  );

  const metrics = useMemo(() => computeDashboardMetrics(trades), [trades]);
  const startingBalance = activeAccount?.startingBalance ?? 0;
  const currentBalance = computeCurrentBalance(startingBalance, trades);
  const hasTrades = trades.length > 0;

  if (!tradesLoaded || !accountsLoaded) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-36 rounded-2xl bg-[#12121a]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#12121a]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-8">
      {!hasTrades && (
        <section className="relative overflow-hidden rounded-2xl border border-indigo-400/25 bg-[#0c0c16] p-6 shadow-[0_0_40px_rgba(99,102,241,0.12)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-violet-600/5 to-emerald-500/10" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300">
              Getting started
            </p>
            <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl">
              Your desk is live
            </h3>
            <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
              {activeAccount
                ? `No trades on ${activeAccount.name} yet. Log a win or loss and this balance will move with net P/L.`
                : "Log your first setup. Account balance, net P/L, and the equity curve unlock from the journal."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/trade-journal"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all duration-300 hover:from-indigo-400 hover:to-violet-400"
              >
                Log your first trade
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Account Balance"
          value={formatBalance(currentBalance)}
          hint={`Start ${formatBalance(startingBalance)} + net P/L`}
          icon={Wallet}
          accent="indigo"
        />
        <StatCard
          label="Net P/L"
          value={formatPnlDollars(metrics.netPnl)}
          hint={
            hasTrades
              ? "Live total from logged wins and losses"
              : "Updates as soon as a trade is saved"
          }
          icon={TrendingUp}
          accent={
            metrics.netPnl > 0
              ? "emerald"
              : metrics.netPnl < 0
                ? "rose"
                : "violet"
          }
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Win Rate"
          value={metrics.winRate !== null ? `${metrics.winRate}%` : "—"}
          hint={
            hasTrades
              ? `${metrics.wins} wins of ${trades.length} trades`
              : "Log trades to calculate"
          }
          icon={TrendingUp}
          accent={winRateAccent(metrics.winRate)}
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Trades This Week"
          value={String(metrics.tradesThisWeek)}
          hint={
            hasTrades
              ? "Since Monday in your timezone"
              : "Your weekly count starts at zero"
          }
          icon={NotebookPen}
          accent={metrics.tradesThisWeek > 0 ? "indigo" : "violet"}
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Avg. R:R"
          value={metrics.avgRr !== null ? metrics.avgRr.toFixed(1) : "—"}
          hint={
            metrics.avgRr !== null
              ? "From entry, stop, and target on logged trades"
              : "Add SL and TP on trades to compute"
          }
          icon={ArrowUpRight}
          accent={rrAccent(metrics.avgRr)}
          isEmpty={metrics.avgRr === null}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0c0c16]/90 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-indigo-400/35">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          <div className="relative">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
              Recent Trades
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Your latest journal entries
            </p>

            {metrics.recentTrades.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 ring-1 ring-indigo-400/20">
                  <NotebookPen className="h-5 w-5 text-indigo-300" />
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-200">
                  No trades logged yet
                </p>
                <p className="mt-1 max-w-xs text-sm text-zinc-500">
                  Capture pair, direction, outcome, and charts in your trade
                  journal.
                </p>
                <Link
                  href="/trade-journal"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-indigo-300 transition-colors hover:text-white"
                >
                  Go to Trade Journal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-2.5">
                {metrics.recentTrades.map((trade) => {
                  const pnl = trade.pnlDollars ?? 0;
                  return (
                    <div
                      key={trade.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${outcomeRowClass[trade.outcome]}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-100">
                          {trade.pair}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${outcomeBadgeClass[trade.outcome]}`}
                          >
                            {trade.outcome}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {trade.direction}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`font-mono text-sm font-bold tabular-nums ${
                            pnl > 0
                              ? "text-emerald-300"
                              : pnl < 0
                                ? "text-rose-300"
                                : "text-sky-300"
                          }`}
                        >
                          {formatPnlDollars(pnl)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {formatLocalDate(trade.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <EconomicCalendar compact />
      </div>
    </div>
  );
});
