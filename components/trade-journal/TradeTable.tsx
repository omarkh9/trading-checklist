"use client";

import { TradeDetailCard } from "@/components/trade-journal/TradeDetailCard";
import { ASSET_CLASS_LABELS, resolveAsset } from "@/lib/trades/assets";
import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Direction, Outcome, Trade } from "@/lib/types/trade";
import { assetClassBadgeClass } from "@/lib/ui/desk";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";

type TradeTableProps = {
  trades: Trade[];
  onDelete: (id: string) => void;
};

const outcomeStyles: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Loss: "bg-rose-500/15 text-rose-400 ring-rose-500/30",
  Breakeven: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

const directionStyles: Record<Direction, string> = {
  Long: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Short: "bg-rose-500/15 text-rose-400 ring-rose-500/30",
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
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <p className="text-lg font-medium text-zinc-300">No trades logged yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Use the form above to add your first journal entry.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-400/15">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {[
                "Pair",
                "Class",
                "Direction",
                "Entry",
                "SL",
                "TP",
                "P/L",
                "Outcome",
                "Date",
                "",
              ].map((heading) => (
                <th
                  key={heading || "actions"}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
                >
                  {heading}
                </th>
              ))}
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
              const canExpand = hasCharts || hasNotes || hasTimeframeCharts;
              const asset = resolveAsset(trade.pair);
              const pnl = trade.pnlDollars ?? 0;

              return (
                <tr key={trade.id} className="group border-b border-white/5">
                  <td colSpan={10} className="p-0">
                    <div
                      className={`grid transition-colors duration-300 ${
                        isExpanded
                          ? "bg-indigo-500/[0.07]"
                          : "hover:bg-indigo-500/[0.06]"
                      }`}
                    >
                      <div className="grid grid-cols-[repeat(9,minmax(0,1fr))_auto] items-center">
                        <div className="px-4 py-3 font-semibold text-zinc-100">
                          {trade.pair}
                        </div>
                        <div className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${assetClassBadgeClass[asset.spec.assetClass]}`}
                          >
                            {ASSET_CLASS_LABELS[asset.spec.assetClass]}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${directionStyles[trade.direction]}`}
                          >
                            {trade.direction}
                          </span>
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
                          className={`px-4 py-3 font-mono text-sm font-semibold ${
                            pnl > 0
                              ? "text-emerald-300"
                              : pnl < 0
                                ? "text-rose-300"
                                : "text-sky-300"
                          }`}
                        >
                          {formatPnlDollars(pnl)}
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
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-indigo-500/15 hover:text-indigo-200"
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
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                            aria-label="Delete trade"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-white/10 p-4 sm:p-5">
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
