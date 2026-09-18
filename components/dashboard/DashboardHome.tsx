"use client";

import type { ChecklistRule } from "@/lib/types/checklist";
import type { Trade } from "@/lib/types/trade";
import {
  CHECKLIST_RULES_STORAGE_KEY,
  TRADES_STORAGE_KEY,
} from "@/lib/storage/keys";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  NotebookPen,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRADES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trade[]) : [];
  } catch {
    return [];
  }
}

function loadChecklistRules(): ChecklistRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHECKLIST_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { rules?: ChecklistRule[] };
    return parsed.rules ?? [];
  } catch {
    return [];
  }
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeRiskReward(trade: Trade): number | null {
  const entry = parseFloat(trade.entryPrice);
  const sl = parseFloat(trade.stopLoss);
  const tp = parseFloat(trade.takeProfit);
  if (![entry, sl, tp].every(Number.isFinite)) return null;

  const risk =
    trade.direction === "Long" ? entry - sl : sl - entry;
  const reward =
    trade.direction === "Long" ? tp - entry : entry - tp;
  if (risk <= 0 || reward <= 0) return null;

  return reward / risk;
}

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  isEmpty?: boolean;
};

function StatCard({ label, value, hint, icon: Icon, isEmpty }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-surface-raised p-5 transition-colors ${
        isEmpty
          ? "border-dashed border-border"
          : "border-border hover:border-border/80 hover:bg-surface-overlay"
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
      <p
        className={`mt-3 text-3xl font-bold tracking-tight ${
          isEmpty ? "text-zinc-600" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}

export function DashboardHome() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [checklistRules, setChecklistRules] = useState<ChecklistRule[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setTrades(loadTrades());
    setChecklistRules(loadChecklistRules());
    setIsLoaded(true);
  }, []);

  const metrics = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const tradesThisWeek = trades.filter(
      (t) => new Date(t.createdAt) >= weekStart
    );
    const wins = trades.filter((t) => t.outcome === "Win").length;
    const winRate =
      trades.length > 0 ? Math.round((wins / trades.length) * 100) : null;

    const rrValues = trades
      .map(computeRiskReward)
      .filter((v): v is number => v !== null);
    const avgRr =
      rrValues.length > 0
        ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(1)
        : null;

    const checked = checklistRules.filter((r) => r.checked).length;
    const checklistTotal = checklistRules.length;
    const checklistScore =
      checklistTotal > 0
        ? Math.round((checked / checklistTotal) * 100)
        : null;

    const recentTrades = [...trades]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    return {
      tradesThisWeek: tradesThisWeek.length,
      winRate,
      avgRr,
      checklistScore,
      checklistTotal,
      checked,
      recentTrades,
    };
  }, [trades, checklistRules]);

  const hasTrades = trades.length > 0;
  const hasChecklistActivity =
    metrics.checklistScore !== null && metrics.checked > 0;

  if (!isLoaded) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-36 rounded-xl bg-surface-raised" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-raised" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!hasTrades && (
        <section className="rounded-xl border border-dashed border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent-hover">
            Getting started
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-100 sm:text-2xl">
            Your dashboard is ready
          </h3>
          <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
            No trades logged yet. Run your pre-trade checklist, then record your
            first setup in the journal to unlock performance stats here.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/trade-journal"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Log your first trade
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pre-trade-checklist"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-surface-overlay hover:text-zinc-100"
            >
              Open pre-trade checklist
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Win Rate"
          value={metrics.winRate !== null ? `${metrics.winRate}%` : "—"}
          hint={
            hasTrades
              ? `${trades.filter((t) => t.outcome === "Win").length} wins of ${trades.length} trades`
              : "Log trades to calculate"
          }
          icon={TrendingUp}
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Trades This Week"
          value={hasTrades ? String(metrics.tradesThisWeek) : "0"}
          hint={
            hasTrades
              ? "Since Monday in your timezone"
              : "Your weekly count starts at zero"
          }
          icon={NotebookPen}
          isEmpty={!hasTrades}
        />
        <StatCard
          label="Checklist Score"
          value={
            metrics.checklistScore !== null
              ? `${metrics.checklistScore}%`
              : "—"
          }
          hint={
            metrics.checklistTotal > 0
              ? `${metrics.checked} of ${metrics.checklistTotal} rules checked`
              : "Complete rules on the checklist page"
          }
          icon={ClipboardCheck}
          isEmpty={!hasChecklistActivity}
        />
        <StatCard
          label="Avg. R:R"
          value={metrics.avgRr !== null ? metrics.avgRr : "—"}
          hint={
            metrics.avgRr !== null
              ? "From entry, stop, and target on logged trades"
              : "Add SL and TP on trades to compute"
          }
          icon={ArrowUpRight}
          isEmpty={metrics.avgRr === null}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface-raised p-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Recent Trades
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Your latest journal entries
          </p>

          {metrics.recentTrades.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-border bg-surface-overlay/40 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-overlay">
                <NotebookPen className="h-5 w-5 text-zinc-500" />
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-300">
                No trades logged yet
              </p>
              <p className="mt-1 max-w-xs text-sm text-zinc-500">
                Capture pair, direction, outcome, and charts in your trade
                journal.
              </p>
              <Link
                href="/trade-journal"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent-hover transition-colors hover:text-white"
              >
                Go to Trade Journal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {metrics.recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between rounded-lg bg-surface-overlay px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{trade.pair}</p>
                    <p className="text-xs text-zinc-500">
                      {trade.outcome} · {trade.direction}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {new Date(trade.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface-raised p-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Pre-Trade Checklist
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Today&apos;s readiness score
          </p>

          {!hasChecklistActivity ? (
            <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-border bg-surface-overlay/40 px-6 py-10 text-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <svg
                  className="h-full w-full -rotate-90"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#1a1a24"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#3f3f46"
                    strokeWidth="8"
                    strokeDasharray="264"
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-2xl font-bold text-zinc-600">—</p>
                  <p className="text-xs text-zinc-500">No score yet</p>
                </div>
              </div>
              <p className="mt-4 max-w-xs text-sm text-zinc-500">
                Check off your trading rules before the session to track
                readiness here.
              </p>
              <Link
                href="/pre-trade-checklist"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent-hover transition-colors hover:text-white"
              >
                Start checklist
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-center">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <svg
                  className="h-full w-full -rotate-90"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#1a1a24"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="8"
                    strokeDasharray={264}
                    strokeDashoffset={
                      264 - ((metrics.checklistScore ?? 0) / 100) * 264
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold text-zinc-100">
                    {metrics.checklistScore}%
                  </p>
                  <p className="text-xs text-zinc-500">Complete</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
