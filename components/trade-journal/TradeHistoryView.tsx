"use client";

import { TradeHistoryGrid } from "@/components/trade-journal/TradeHistoryGrid";
import { usePersistedTrades } from "@/components/trade-journal/usePersistedTrades";

export function TradeHistoryView() {
  const { trades, startingBalance, isLoaded, error, handleUpdate, handleDelete } =
    usePersistedTrades();

  if (!isLoaded) {
    return <div className="h-64 animate-pulse rounded-xl bg-surface-raised" />;
  }

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-6">
      {error && (
        <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <TradeHistoryGrid
        trades={trades}
        startingBalance={startingBalance}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />
    </section>
  );
}
