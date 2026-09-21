"use client";

import { DeskCard } from "@/components/ui/DeskCard";
import { AccountBalancePanel } from "@/components/trade-journal/AccountBalancePanel";
import { TradeForm } from "@/components/trade-journal/TradeForm";
import { TradeHistoryGrid } from "@/components/trade-journal/TradeHistoryGrid";
import { usePersistedTrades } from "@/components/trade-journal/usePersistedTrades";
import { desk } from "@/lib/ui/desk";

export function TradeJournal() {
  const {
    trades,
    accounts,
    activeAccount,
    currentBalance,
    accountBalances,
    isLoaded,
    error,
    handleSubmit,
    handleUpdate,
    handleDelete,
  } = usePersistedTrades();

  if (!isLoaded) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[#12121a]" />;
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      <AccountBalancePanel currentBalance={currentBalance} />

      <TradeForm
        accounts={accounts}
        accountBalances={accountBalances}
        defaultAccountId={activeAccount?.id ?? ""}
        onSubmit={handleSubmit}
      />

      <DeskCard>
        <div className="mb-6">
          <h3 className={desk.title}>Trade History</h3>
          <p className={desk.subtitle}>
            {activeAccount
              ? `Journal for ${activeAccount.name}. Filter, review, update, or remove logged trades.`
              : "Filter, review, update, or remove logged trades."}
          </p>
        </div>

        <TradeHistoryGrid
          trades={trades}
          accounts={accounts}
          accountBalances={accountBalances}
          fallbackAccountId={accounts[0]?.id ?? ""}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          emptyHint={
            activeAccount
              ? `No trades on ${activeAccount.name} yet. Log a trade above, or switch accounts.`
              : undefined
          }
        />
      </DeskCard>
    </div>
  );
}
