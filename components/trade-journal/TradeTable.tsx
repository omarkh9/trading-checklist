"use client";

import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Direction, Outcome, Trade } from "@/lib/types/trade";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";

type TradeTableProps = {
  trades: Trade[];
  onDelete: (id: string) => void;
};

const outcomeStyles: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Loss: "bg-red-500/15 text-red-400 ring-red-500/30",
  Breakeven: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

const directionStyles: Record<Direction, string> = {
  Long: "text-emerald-400",
  Short: "text-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        <p className="text-sm text-zinc-600">No {label.toLowerCase()} uploaded</p>
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
          className="h-48 w-full cursor-pointer object-cover transition-transform hover:scale-[1.02]"
        />
      </div>
    </div>
  );
}

export function TradeTable({ trades, onDelete }: TradeTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-raised/50 p-12 text-center">
        <p className="text-lg font-medium text-zinc-300">No trades logged yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Use the form above to add your first journal entry.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-overlay/50">
              <th className="px-4 py-3 font-medium text-zinc-400">Pair</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Direction</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Entry</th>
              <th className="px-4 py-3 font-medium text-zinc-400">SL</th>
              <th className="px-4 py-3 font-medium text-zinc-400">TP</th>
              <th className="px-4 py-3 font-medium text-zinc-400">P/L</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Outcome</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Date</th>
              <th className="px-4 py-3 font-medium text-zinc-400">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const isExpanded = expandedId === trade.id;
              const hasCharts = trade.beforeChart || trade.afterChart;
              const hasNotes = trade.notes.trim().length > 0;
              const hasTimeframeCharts =
                Boolean(trade.higherTimeFrame) ||
                Boolean(trade.middleTimeFrame) ||
                Boolean(trade.lowerTimeFrame) ||
                Boolean(trade.entry);
              const canExpand =
                hasCharts || hasNotes || hasTimeframeCharts;

              return (
                <tr key={trade.id} className="group border-b border-border-subtle">
                  <td colSpan={9} className="p-0">
                    <div
                      className={`grid transition-colors ${
                        isExpanded ? "bg-surface-overlay/30" : "hover:bg-surface-overlay/20"
                      }`}
                    >
                      <div className="grid grid-cols-[repeat(8,minmax(0,1fr))_auto] items-center">
                        <div className="px-4 py-3 font-semibold text-zinc-100">
                          {trade.pair}
                        </div>
                        <div
                          className={`px-4 py-3 font-medium ${directionStyles[trade.direction]}`}
                        >
                          {trade.direction}
                        </div>
                        <div className="px-4 py-3 font-mono text-zinc-300">
                          {trade.entryPrice || "—"}
                        </div>
                        <div className="px-4 py-3 font-mono text-zinc-400">
                          {trade.stopLoss || "—"}
                        </div>
                        <div className="px-4 py-3 font-mono text-zinc-400">
                          {trade.takeProfit || "—"}
                        </div>
                        <div
                          className={`px-4 py-3 font-mono text-sm ${
                            trade.pnlDollars > 0
                              ? "text-emerald-400"
                              : trade.pnlDollars < 0
                                ? "text-rose-400"
                                : "text-zinc-500"
                          }`}
                        >
                          {formatPnlDollars(trade.pnlDollars ?? 0)}
                        </div>
                        <div className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${outcomeStyles[trade.outcome]}`}
                          >
                            {trade.outcome}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-zinc-500">
                          {formatDate(trade.createdAt)}
                        </div>
                        <div className="flex items-center gap-1 px-4 py-3">
                          {canExpand && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(isExpanded ? null : trade.id)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-surface-overlay hover:text-zinc-200"
                              aria-label={isExpanded ? "Collapse row" : "Expand row"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDelete(trade.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                            aria-label="Delete trade"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border-subtle px-4 py-5">
                          {(trade.lotSize || trade.pnlInput) && (
                            <div className="mb-5 flex flex-wrap gap-4 text-sm text-zinc-400">
                              {trade.lotSize && (
                                <span>
                                  Lot:{" "}
                                  <span className="font-mono text-zinc-200">
                                    {trade.lotSize}
                                  </span>
                                </span>
                              )}
                              {trade.pnlInput && (
                                <span>
                                  P/L input: {trade.pnlInput}
                                  {trade.pnlMode === "percent" ? "%" : " USD"}
                                </span>
                              )}
                            </div>
                          )}
                          {hasTimeframeCharts && (
                            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <ChartPreview
                                label="Higher Time Frame"
                                src={trade.higherTimeFrame}
                              />
                              <ChartPreview
                                label="Middle Time Frame"
                                src={trade.middleTimeFrame}
                              />
                              <ChartPreview
                                label="Lower Time Frame"
                                src={trade.lowerTimeFrame}
                              />
                              <ChartPreview label="Entry" src={trade.entry} />
                            </div>
                          )}
                          {hasNotes && (
                            <div className="mb-5">
                              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Notes
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                                {trade.notes}
                              </p>
                            </div>
                          )}
                          {(trade.beforeChart || trade.afterChart) && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <ChartPreview
                                label="Before Chart (Setup)"
                                src={trade.beforeChart}
                              />
                              <ChartPreview
                                label="After Chart (Result)"
                                src={trade.afterChart}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
