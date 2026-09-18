"use client";

import { TradeDetailCard } from "@/components/trade-journal/TradeDetailCard";
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
                        <div className="border-t border-border-subtle p-4 sm:p-5">
                          <TradeDetailCard trade={trade} />
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
