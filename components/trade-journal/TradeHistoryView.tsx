"use client";

import { TradeHistoryGrid } from "@/components/trade-journal/TradeHistoryGrid";
import { usePersistedTrades } from "@/components/trade-journal/usePersistedTrades";

export function TradeHistoryView() {
  const { trades, startingBalance, isLoaded, handleUpdate, handleDelete } =
    usePersistedTrades();

  if (!isLoaded) {
    return <div className="h-64 animate-pulse rounded-xl bg-surface-raised" />;
  }

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-6">
      <TradeHistoryGrid
        trades={trades}
        startingBalance={startingBalance}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />
    </section>
  );
}
