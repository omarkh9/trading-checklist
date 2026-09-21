"use client";

import { RuleScoreStat } from "@/components/trade-journal/RuleScoreStat";
import { formatLocalDateTime } from "@/lib/time";
import { ASSET_CLASS_LABELS, resolveAsset } from "@/lib/trades/assets";
import { formatPnlDollars } from "@/lib/trades/pnl";
import { emotionEmoji, emotionLabel } from "@/lib/types/emotion";
import type { Direction, Outcome, Trade } from "@/lib/types/trade";
import { assetClassBadgeClass } from "@/lib/ui/desk";

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
  return formatLocalDateTime(iso);
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
      <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02]">
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
      <div className="overflow-hidden rounded-lg border border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="h-36 w-full object-cover transition-transform hover:scale-[1.02]"
        />
      </div>
    </div>
  );
}

type TradeDetailCardProps = {
  trade: Trade;
};

export function TradeDetailCard({ trade }: TradeDetailCardProps) {
  const asset = resolveAsset(trade.pair);
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
    <article className="rounded-xl border border-indigo-400/15 bg-[#0c0c16]/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-semibold tracking-tight text-zinc-50">
            {trade.pair}
          </h4>
          <p className="mt-1 text-sm text-zinc-500">
            {formatTradeDateTime(trade.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${assetClassBadgeClass[asset.spec.assetClass]}`}
          >
            {ASSET_CLASS_LABELS[asset.spec.assetClass]}
          </span>
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
            <span className="inline-flex rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-indigo-400/30">
              {trade.strategy.trim()}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Multi-timeframe charts
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <ChartPreview label="Before Chart (Setup)" src={trade.beforeChart} />
            <ChartPreview label="After Chart (Result)" src={trade.afterChart} />
          </div>
        </div>

        <div>
          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            <div className={`flex h-full flex-col justify-center rounded-lg border px-4 py-3 ${pnlCardClass}`}>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Profit / Loss
              </p>
              <p className={`mt-1 font-mono text-lg font-semibold ${pnlColor}`}>
                {formatPnlSummary(trade)}
              </p>
            </div>
            <RuleScoreStat score={trade.ruleScore} />
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <dt className="text-xs text-zinc-500">Entry Price</dt>
              <dd className="font-mono text-sm text-zinc-200">
                {trade.entryPrice || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <dt className="text-xs text-zinc-500">Exit Price</dt>
              <dd className="font-mono text-sm text-zinc-200">
                {trade.exitPrice || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <dt className="text-xs text-zinc-500">Stop Loss</dt>
              <dd className="font-mono text-sm text-zinc-200">
                {trade.stopLoss || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <dt className="text-xs text-zinc-500">Take Profit</dt>
              <dd className="font-mono text-sm text-zinc-200">
                {trade.takeProfit || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <dt className="text-xs text-zinc-500">Lot Size</dt>
              <dd className="font-mono text-sm text-zinc-200">
                {trade.lotSize || "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <p className="text-xs text-zinc-500">Before entry</p>
              <p className="mt-1 text-sm text-zinc-200">
                {trade.emotionBefore
                  ? `${emotionEmoji(trade.emotionBefore)} ${emotionLabel(trade.emotionBefore)}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <p className="text-xs text-zinc-500">After entry</p>
              <p className="mt-1 text-sm text-zinc-200">
                {trade.emotionAfter
                  ? `${emotionEmoji(trade.emotionAfter)} ${emotionLabel(trade.emotionAfter)}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Notes
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {trade.notes.trim() || "No notes for this trade."}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
