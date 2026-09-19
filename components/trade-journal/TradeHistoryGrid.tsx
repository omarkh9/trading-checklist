"use client";

import { TradeDetailModal } from "@/components/trade-journal/TradeDetailModal";
import { TradeEditModal } from "@/components/trade-journal/TradeEditModal";
import { computeCurrentBalance } from "@/lib/trades/account-balance";
import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Direction, Outcome, Trade, TradeFormData } from "@/lib/types/trade";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type FilterTab = "All" | Outcome;

type TradeHistoryGridProps = {
  trades: Trade[];
  startingBalance: number;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, data: TradeFormData) => void | Promise<void>;
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TradeHistoryGrid({
  trades,
  startingBalance,
  onDelete,
  onUpdate,
}: TradeHistoryGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [viewTradeId, setViewTradeId] = useState<string | null>(null);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);

  const sortedTrades = useMemo(
    () =>
      [...trades].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "border border-border bg-surface-overlay text-zinc-400 hover:text-zinc-200"
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
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-raised/50 px-6 py-14 text-center">
          <p className="text-lg font-medium text-zinc-300">No trades found</p>
          <p className="mt-2 text-sm text-zinc-500">
            {activeFilter === "All"
              ? "Log your first trade using the form above."
              : `No ${activeFilter.toLowerCase()} trades yet. Try another filter.`}
          </p>
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
                className="flex flex-col rounded-xl border border-border bg-surface-raised p-5 transition-colors hover:border-border/80 hover:bg-surface-overlay/40"
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

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setViewTradeId(trade.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-surface-overlay/80"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTradeId(trade.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-medium text-accent-hover transition-colors hover:bg-accent/20"
                  >
                    <Pencil className="h-4 w-4" />
                    Update Trade
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(trade.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`Delete ${trade.pair} trade`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
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
