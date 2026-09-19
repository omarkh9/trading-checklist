"use client";

import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Direction, Outcome, Trade } from "@/lib/types/trade";

const outcomeBadgeClass: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Loss: "bg-red-500/15 text-red-400 ring-red-500/30",
  Breakeven: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
};

const directionBadgeClass: Record<Direction, string> = {
  Long: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Short: "bg-red-500/15 text-red-400 ring-red-500/30",
};

function formatTradeDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPnlSummary(trade: Trade) {
  const dollars = formatPnlDollars(trade.pnlDollars ?? 0);
  if (!trade.pnlInput?.trim()) return dollars;

  const inputLabel =
    trade.pnlMode === "percent"
      ? `${trade.pnlInput}%`
      : `$${trade.pnlInput}`;

  return `${dollars} · logged as ${inputLabel}`;
}

function ChartPreview({
  label,
  src,
}: {
  label: string;
  src: string | null;
}) {
  if (!src) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface-overlay/50">
        <p className="px-2 text-center text-sm text-zinc-600">
          No {label.toLowerCase()} uploaded
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="h-48 w-full object-cover transition-transform hover:scale-[1.02]"
        />
      </div>
    </div>
  );
}

type TradeDetailCardProps = {
  trade: Trade;
};

export function TradeDetailCard({ trade }: TradeDetailCardProps) {
  const pnlColor =
    trade.pnlDollars > 0
      ? "text-emerald-400"
      : trade.pnlDollars < 0
        ? "text-rose-400"
        : "text-sky-300";

  const pnlCardClass =
    trade.pnlDollars > 0
      ? "border-emerald-400/40 bg-emerald-500/10"
      : trade.pnlDollars < 0
        ? "border-rose-400/40 bg-rose-500/10"
        : "border-blue-400/40 bg-blue-500/10";

  return (
    <article className="rounded-xl border border-border bg-surface-overlay/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-semibold tracking-tight text-zinc-100">
            {trade.pair}
          </h4>
          <p className="mt-1 text-sm text-zinc-500">
            {formatTradeDateTime(trade.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${directionBadgeClass[trade.direction]}`}
          >
            {trade.direction}
          </span>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${outcomeBadgeClass[trade.outcome]}`}
          >
            {trade.outcome}
          </span>
          {trade.strategy.trim() && (
            <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-hover ring-1 ring-accent/30">
              {trade.strategy.trim()}
            </span>
          )}
        </div>
      </div>

      <div className={`mt-4 rounded-lg border px-4 py-3 ${pnlCardClass}`}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Profit / Loss
        </p>
        <p className={`mt-1 font-mono text-lg font-semibold ${pnlColor}`}>
          {formatPnlSummary(trade)}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
          <dt className="text-xs text-zinc-500">Entry Price</dt>
          <dd className="font-mono text-sm text-zinc-200">
            {trade.entryPrice || "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
          <dt className="text-xs text-zinc-500">Stop Loss</dt>
          <dd className="font-mono text-sm text-zinc-200">
            {trade.stopLoss || "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
          <dt className="text-xs text-zinc-500">Take Profit</dt>
          <dd className="font-mono text-sm text-zinc-200">
            {trade.takeProfit || "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
          <dt className="text-xs text-zinc-500">Lot Size</dt>
          <dd className="font-mono text-sm text-zinc-200">
            {trade.lotSize || "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Notes
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {trade.notes.trim() || "No notes for this trade."}
        </p>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Multi-Timeframe Charts
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ChartPreview
            label="Higher Time Frame"
            src={trade.higherTimeFrame}
          />
          <ChartPreview
            label="Middle Time Frame"
            src={trade.middleTimeFrame}
          />
          <ChartPreview label="Lower Time Frame" src={trade.lowerTimeFrame} />
          <ChartPreview label="Entry" src={trade.entry} />
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Setup & Result
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChartPreview label="Before Chart (Setup)" src={trade.beforeChart} />
          <ChartPreview label="After Chart (Result)" src={trade.afterChart} />
        </div>
      </div>
    </article>
  );
}
