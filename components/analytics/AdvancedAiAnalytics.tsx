"use client";

import { useBehavioralAudit } from "@/components/analytics/useBehavioralAudit";
import { MarkdownMessage } from "@/components/ai/MarkdownMessage";
import { DeskCard } from "@/components/ui/DeskCard";
import {
  computeAdvancedAnalytics,
  type DisciplineGrade,
  type SessionPerformance,
  type WinRateSlice,
} from "@/lib/trades/advanced-analytics";
import { formatSignedCompactPnl } from "@/lib/trades/analytics";
import { formatWinRate } from "@/lib/trades/day-stats";
import type { Trade } from "@/lib/types/trade";
import { desk } from "@/lib/ui/desk";
import {
  AlertTriangle,
  Clock3,
  Percent,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import { useMemo } from "react";

type AdvancedAiAnalyticsProps = {
  trades: Trade[];
  accountId?: string;
  accountName?: string;
};

function winRateLabel(value: number | null) {
  return value == null ? "—" : formatWinRate(value);
}

function pnlClass(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-zinc-400";
}

function gradeTone(grade: DisciplineGrade) {
  if (grade === "A") return "text-emerald-300";
  if (grade === "B") return "text-indigo-300";
  if (grade === "C") return "text-amber-300";
  if (grade === "D" || grade === "F") return "text-rose-300";
  return "text-zinc-500";
}

function ringColor(score: number | null) {
  if (score == null) return "#52525b";
  if (score >= 85) return "#34d399";
  if (score >= 70) return "#818cf8";
  if (score >= 55) return "#fbbf24";
  return "#fb7185";
}

function WinRateCard({ slice }: { slice: WinRateSlice }) {
  return (
    <DeskCard>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {slice.label}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
          <Percent className="h-4 w-4" />
        </div>
      </div>
      <p
        className={`mt-3 text-3xl font-bold tracking-tight ${
          slice.winRate == null
            ? "text-zinc-600"
            : slice.winRate >= 50
              ? "text-emerald-300"
              : slice.winRate < 40
                ? "text-rose-300"
                : "text-zinc-50"
        }`}
      >
        {winRateLabel(slice.winRate)}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {slice.trades === 0
          ? "No trades in this slice"
          : `${slice.wins}W / ${slice.losses}L / ${slice.breakevens} BE · `}
        {slice.trades > 0 ? (
          <span className={pnlClass(slice.netPnl)}>
            {formatSignedCompactPnl(slice.netPnl)}
          </span>
        ) : null}
      </p>
    </DeskCard>
  );
}

function SessionRow({ row }: { row: SessionPerformance }) {
  const width = row.winRate == null ? 0 : Math.max(4, Math.min(100, row.winRate));
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-2 font-medium text-zinc-200">
          {row.label}
          {row.isLeak ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200 ring-1 ring-rose-400/30">
              <AlertTriangle className="h-3 w-3" />
              Leak
            </span>
          ) : null}
        </span>
        <span className="shrink-0 tabular-nums text-zinc-400">
          {winRateLabel(row.winRate)} · {row.trades} ·{" "}
          <span className={pnlClass(row.netPnl)}>
            {formatSignedCompactPnl(row.netPnl)}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${
            row.isLeak
              ? "bg-rose-400"
              : row.netPnl > 0
                ? "bg-emerald-400"
                : "bg-indigo-400"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  );
}

export function AdvancedAiAnalytics({
  trades,
  accountId,
  accountName,
}: AdvancedAiAnalyticsProps) {
  const report = useMemo(() => computeAdvancedAnalytics(trades), [trades]);
  const audit = useBehavioralAudit({
    pathname: "/analytics",
    pageTitle: "Advanced AI Analytics",
    accountId,
    accountName,
  });

  const score = report.discipline.score;
  const hasTrades = report.tradeCount > 0;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300/80">
          Advanced AI Analytics
        </p>
        <h2 className={desk.title}>Behavioral desk for Owz</h2>
        <p className={desk.subtitle}>
          Win rates, session leaks, and risk discipline from the same Supabase
          journal the dashboard uses
          {accountName ? ` · ${accountName}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <WinRateCard slice={report.overall} />
        {report.byDirection.map((slice) => (
          <WinRateCard key={slice.id} slice={slice} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DeskCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={desk.title}>Session performance leaks</h3>
              <p className={desk.subtitle}>
                P/L and win rate by FX session at fill time
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>

          {!hasTrades ? (
            <p className="mt-6 text-sm text-zinc-500">
              Session leaks appear after the first timestamped trade.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {report.sessions
                .filter((row) => row.trades > 0)
                .map((row) => (
                  <SessionRow key={row.id} row={row} />
                ))}
            </ul>
          )}

          {report.primaryLeak ? (
            <p className="mt-5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              Primary leak: <strong>{report.primaryLeak.label}</strong> is the
              weakest session in this sample.
            </p>
          ) : hasTrades ? (
            <p className="mt-5 text-xs text-zinc-500">
              No session is leaking hard enough to flag yet.
            </p>
          ) : null}
        </DeskCard>

        <DeskCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={desk.title}>Risk discipline score</h3>
              <p className={desk.subtitle}>
                Size consistency, stops, checklist, and early exits
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div
              className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${ringColor(score)} ${score ?? 0}%, rgba(255,255,255,0.08) 0)`,
              }}
            >
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#0c0c16]">
                <span className="text-2xl font-bold text-zinc-50">
                  {score ?? "—"}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${gradeTone(report.discipline.grade)}`}
                >
                  {report.discipline.grade}
                </span>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2 text-sm text-zinc-400">
              {report.discipline.notes.map((note) => (
                <li key={note} className="leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </DeskCard>
      </div>

      <DeskCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={desk.title}>Automated behavioral audit</h3>
            <p className={desk.subtitle}>
              Streams from the same AI endpoint as the coach, with this journal
              snapshot in context
            </p>
          </div>
          <div className="flex items-center gap-2">
            {audit.streaming ? (
              <button type="button" onClick={audit.stop} className={desk.btnGhost}>
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void audit.run()}
                disabled={!hasTrades}
                className={desk.btnPrimary}
              >
                <Sparkles className="h-4 w-4" />
                {audit.text ? "Re-run audit" : "Run behavioral audit"}
              </button>
            )}
          </div>
        </div>

        {audit.error ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {audit.error}
          </p>
        ) : null}

        {!hasTrades ? (
          <p className="mt-6 text-sm text-zinc-500">
            Log trades in the journal first. The audit reads the same Supabase
            trades table as the dashboard.
          </p>
        ) : audit.text || audit.streaming ? (
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <MarkdownMessage content={audit.text} streaming={audit.streaming} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">
            Run the audit to get a verdict on win-rate patterns, the leaking
            session, and what to change on the next five trades.
          </p>
        )}
      </DeskCard>
    </section>
  );
}
