import { DashboardShell } from "@/components/DashboardShell";
import {
  ArrowUpRight,
  ClipboardCheck,
  NotebookPen,
  TrendingUp,
} from "lucide-react";

const stats = [
  {
    label: "Win Rate",
    value: "68%",
    change: "+4.2%",
    icon: TrendingUp,
    positive: true,
  },
  {
    label: "Trades This Week",
    value: "24",
    change: "+6",
    icon: NotebookPen,
    positive: true,
  },
  {
    label: "Checklist Score",
    value: "92%",
    change: "+2%",
    icon: ClipboardCheck,
    positive: true,
  },
  {
    label: "Avg. R:R",
    value: "2.4",
    change: "+0.3",
    icon: ArrowUpRight,
    positive: true,
  },
];

export default function DashboardPage() {
  return (
    <DashboardShell
      title="Dashboard"
      description="Overview of your trading performance and activity"
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-surface-raised p-5 transition-colors hover:border-border/80 hover:bg-surface-overlay"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-400">
                    {stat.label}
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-100">
                  {stat.value}
                </p>
                <p
                  className={`mt-1 text-sm ${
                    stat.positive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {stat.change} from last week
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-surface-raised p-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Recent Trades
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Your latest journal entries
            </p>
            <div className="mt-6 space-y-3">
              {[
                { symbol: "ES", result: "Win", pnl: "+$420" },
                { symbol: "NQ", result: "Loss", pnl: "-$180" },
                { symbol: "CL", result: "Win", pnl: "+$310" },
              ].map((trade) => (
                <div
                  key={trade.symbol}
                  className="flex items-center justify-between rounded-lg bg-surface-overlay px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{trade.symbol}</p>
                    <p className="text-xs text-zinc-500">{trade.result}</p>
                  </div>
                  <p
                    className={`font-mono text-sm font-medium ${
                      trade.pnl.startsWith("+")
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {trade.pnl}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-raised p-6">
            <h3 className="text-lg font-semibold text-zinc-100">
              Pre-Trade Checklist
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Today&apos;s readiness score
            </p>
            <div className="mt-6 flex items-center justify-center">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
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
                    strokeDasharray="264"
                    strokeDashoffset="21"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold text-zinc-100">92%</p>
                  <p className="text-xs text-zinc-500">Complete</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
