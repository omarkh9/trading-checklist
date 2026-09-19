"use client";

import { TradeHistoryGrid } from "@/components/trade-journal/TradeHistoryGrid";
import { usePersistedTrades } from "@/components/trade-journal/usePersistedTrades";
import { DeskCard } from "@/components/ui/DeskCard";

export function TradeHistoryView() {
  const { trades, startingBalance, isLoaded, error, handleUpdate, handleDelete } =
    usePersistedTrades();

  if (!isLoaded) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[#0c0c16]/80" />;
  }

  return (
    <DeskCard>
      {error && (
        <p className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      <TradeHistoryGrid
        trades={trades}
        startingBalance={startingBalance}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        variant="table"
        emptyHint="Log a trade from the journal to populate this table."
      />
    </DeskCard>
  );
}
