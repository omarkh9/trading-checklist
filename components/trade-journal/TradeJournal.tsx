"use client";

import { AccountBalancePanel } from "@/components/trade-journal/AccountBalancePanel";
import { TradeForm } from "@/components/trade-journal/TradeForm";
import { TradeTable } from "@/components/trade-journal/TradeTable";
import { TRADES_STORAGE_KEY } from "@/lib/storage/keys";
import {
  computeCurrentBalance,
  loadAccountSettings,
  saveAccountSettings,
} from "@/lib/trades/account-balance";
import { loadTrades } from "@/lib/trades/load-trades";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { useEffect, useMemo, useState } from "react";

export function TradeJournal() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [startingBalance, setStartingBalance] = useState(10_000);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setTrades(loadTrades());
    setStartingBalance(loadAccountSettings().startingBalance);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades));
  }, [trades, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    saveAccountSettings({ startingBalance });
  }, [startingBalance, isLoaded]);

  const currentBalance = useMemo(
    () => computeCurrentBalance(startingBalance, trades),
    [startingBalance, trades]
  );

  const handleSubmit = (data: TradeFormData) => {
    const trade: Trade = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setTrades((prev) => [trade, ...prev]);
  };

  const handleDelete = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

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

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Trade History</h3>
            <p className="text-sm text-zinc-500">
              {trades.length} {trades.length === 1 ? "entry" : "entries"} logged
            </p>
          </div>
        </div>
        <TradeTable trades={trades} onDelete={handleDelete} />
      </div>
    </div>
  );
}
