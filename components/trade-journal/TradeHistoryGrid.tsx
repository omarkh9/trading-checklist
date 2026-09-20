"use client";

import { TradeDetailModal } from "@/components/trade-journal/TradeDetailModal";
import { TradeEditModal } from "@/components/trade-journal/TradeEditModal";
import { computeCurrentBalance } from "@/lib/trades/account-balance";
import { ASSET_CLASS_LABELS, resolveAsset } from "@/lib/trades/assets";
import { formatLocalDateTime, timestampMs } from "@/lib/time";
import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Direction, Outcome, Trade, TradeFormData } from "@/lib/types/trade";
import { assetClassBadgeClass } from "@/lib/ui/desk";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type FilterTab = "All" | Outcome;

type TradeHistoryGridProps = {
  trades: Trade[];
  startingBalance: number;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, data: TradeFormData) => void | Promise<void>;
  variant?: "cards" | "table";
  emptyHint?: string;
};

const outcomeBadgeClass: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Loss: "bg-red-500/15 text-red-400 ring-red-500/30",
  Breakeven: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
};

const directionBadgeClass: Record<Direction, string> = {
  Long: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Short: "bg-red-500/15 text-red-400 ring-red-500/30",
};

const FILTER_TABS: FilterTab[] = ["All", "Win", "Loss", "Breakeven"];

function formatCardDate(iso: string) {
  return formatLocalDateTime(iso);
}

export function TradeHistoryGrid({
  trades,
  startingBalance,
  onDelete,
  onUpdate,
  variant = "cards",
  emptyHint,
}: TradeHistoryGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [viewTradeId, setViewTradeId] = useState<string | null>(null);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);

  const sortedTrades = useMemo(
    () =>
      [...trades].sort(
        (a, b) =>
          timestampMs(b.createdAt) - timestampMs(a.createdAt)
      ),
    [trades]
  );

  const filteredTrades = useMemo(() => {
    if (activeFilter === "All") return sortedTrades;
    return sortedTrades.filter((trade) => trade.outcome === activeFilter);
  }, [activeFilter, sortedTrades]);

  const viewTrade = viewTradeId
    ? trades.find((trade) => trade.id === viewTradeId) ?? null
    : null;

  const editTrade = editTradeId
    ? trades.find((trade) => trade.id === editTradeId) ?? null
    : null;

  const editBalance = useMemo(() => {
    if (!editTrade) return startingBalance;
    const others = trades.filter((trade) => trade.id !== editTrade.id);
    return computeCurrentBalance(startingBalance, others);
  }, [editTrade, startingBalance, trades]);

  const tabCounts = useMemo(
    () => ({
      All: sortedTrades.length,
      Win: sortedTrades.filter((t) => t.outcome === "Win").length,
      Loss: sortedTrades.filter((t) => t.outcome === "Loss").length,
      Breakeven: sortedTrades.filter((t) => t.outcome === "Breakeven").length,
    }),
    [sortedTrades]
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? "bg-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.3)]"
                  : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:border-indigo-400/30 hover:text-zinc-200"
              }`}
            >
              {tab}
              <span
                className={`ml-2 text-xs ${isActive ? "text-white/80" : "text-zinc-500"}`}
              >
                {tabCounts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      {filteredTrades.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <p className="text-lg font-medium text-zinc-300">No trades found</p>
          <p className="mt-2 text-sm text-zinc-500">
            {activeFilter === "All"
              ? emptyHint ?? "Log your first trade using the form above."
              : `No ${activeFilter.toLowerCase()} trades yet. Try another filter.`}
          </p>
        </div>
      ) : (
        variant === "table" ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-indigo-400/15">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  {["Pair", "Class", "Direction", "P/L", "Outcome", "Date", ""].map(
                    (heading) => (
                      <th
                        key={heading || "actions"}
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => {
                  const pnl = trade.pnlDollars ?? 0;
                  const asset = resolveAsset(trade.pair);
                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-white/5 transition-colors duration-300 hover:bg-indigo-500/[0.06]"
                    >
                      <td className="px-4 py-3 font-semibold text-zinc-100">
                        {trade.pair}
                        {trade.strategy.trim() && (
                          <p className="mt-0.5 text-[11px] font-normal text-zinc-500">
                            {trade.strategy}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${assetClassBadgeClass[asset.spec.assetClass]}`}
                        >
                          {ASSET_CLASS_LABELS[asset.spec.assetClass]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${directionBadgeClass[trade.direction]}`}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-sm font-semibold ${
                          pnl > 0
                            ? "text-emerald-300"
                            : pnl < 0
                              ? "text-rose-300"
                              : "text-sky-300"
                        }`}
                      >
                        {formatPnlDollars(pnl)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${outcomeBadgeClass[trade.outcome]}`}
                        >
                          {trade.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {formatCardDate(trade.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewTradeId(trade.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-indigo-500/15 hover:text-indigo-200"
                            aria-label={`View ${trade.pair}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTradeId(trade.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-indigo-500/15 hover:text-indigo-200"
                            aria-label={`Edit ${trade.pair}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(trade.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                            aria-label={`Delete ${trade.pair}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTrades.map((trade) => {
            const pnl = trade.pnlDollars ?? 0;
            const notesPreview = trade.notes.trim() || "No notes added yet.";
            const pnlTone =
              pnl > 0 ? "positive" : pnl < 0 ? "negative" : "breakeven";
            const pnlCardClass =
              pnlTone === "positive"
                ? "border-emerald-400/40 bg-emerald-500/10"
                : pnlTone === "negative"
                  ? "border-rose-400/40 bg-rose-500/10"
                  : "border-blue-400/40 bg-blue-500/10";
            const pnlTextClass =
              pnlTone === "positive"
                ? "text-emerald-400"
                : pnlTone === "negative"
                  ? "text-rose-400"
                  : "text-sky-300";

            return (
              <article
                key={trade.id}
                className="flex flex-col rounded-xl border border-indigo-400/15 bg-[#0c0c16]/80 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-all duration-300 hover:border-indigo-400/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-zinc-100">
                      {trade.pair}
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatCardDate(trade.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
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
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${assetClassBadgeClass[resolveAsset(trade.pair).spec.assetClass]}`}
                    >
                      {ASSET_CLASS_LABELS[resolveAsset(trade.pair).spec.assetClass]}
                    </span>
                    {trade.strategy.trim() && (
                      <span className="inline-flex rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-indigo-400/30">
                        {trade.strategy.trim()}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`mt-4 rounded-lg border px-3 py-2.5 ${pnlCardClass}`}>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Total P/L
                  </p>
                  <p
                    className={`mt-1 font-mono text-xl font-semibold ${pnlTextClass}`}
                  >
                    {formatPnlDollars(pnl)}
                  </p>
                </div>

                <p className="mt-4 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-400">
                  {notesPreview}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setViewTradeId(trade.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 transition-all duration-300 hover:border-indigo-400/30 hover:bg-indigo-500/10"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTradeId(trade.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 transition-all duration-300 hover:bg-indigo-500/20"
                  >
                    <Pencil className="h-4 w-4" />
                    Update Trade
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(trade.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-zinc-400 transition-all duration-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                    aria-label={`Delete ${trade.pair} trade`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        )
      )}

      {viewTrade && (
        <TradeDetailModal
          trade={viewTrade}
          title={`${viewTrade.pair} — Trade Details`}
          subtitle={formatCardDate(viewTrade.createdAt)}
          onClose={() => setViewTradeId(null)}
        />
      )}

      {editTrade && (
        <TradeEditModal
          trade={editTrade}
          currentBalance={editBalance}
          onSave={async (data) => onUpdate(editTrade.id, data)}
          onClose={() => setEditTradeId(null)}
        />
      )}
    </>
  );
}
