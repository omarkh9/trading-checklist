"use client";

import { AccountBalancePanel } from "@/components/trade-journal/AccountBalancePanel";
import { TradeForm } from "@/components/trade-journal/TradeForm";
import { TradeHistoryGrid } from "@/components/trade-journal/TradeHistoryGrid";
import { usePersistedTrades } from "@/components/trade-journal/usePersistedTrades";

export function TradeJournal() {
  const {
    trades,
    startingBalance,
    setStartingBalance,
    currentBalance,
    isLoaded,
    handleSubmit,
    handleUpdate,
    handleDelete,
  } = usePersistedTrades();

  if (!isLoaded) {
    return <div className="h-64 animate-pulse rounded-xl bg-surface-raised" />;
  }

  return (
    <div className="space-y-8">
      <AccountBalancePanel
        startingBalance={startingBalance}
        currentBalance={currentBalance}
        onStartingBalanceChange={setStartingBalance}
      />

      <TradeForm currentBalance={currentBalance} onSubmit={handleSubmit} />

      <section className="rounded-xl border border-border bg-surface-raised p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-zinc-100">Trade History</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Filter, review, update, or remove logged trades.
          </p>
        </div>

        <TradeHistoryGrid
          trades={trades}
          startingBalance={startingBalance}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      </section>
    </div>
  );
}
