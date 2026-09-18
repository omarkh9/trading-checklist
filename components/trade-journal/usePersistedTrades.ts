"use client";

import { TRADES_STORAGE_KEY } from "@/lib/storage/keys";
import {
  computeCurrentBalance,
  loadAccountSettings,
  saveAccountSettings,
} from "@/lib/trades/account-balance";
import { loadTrades } from "@/lib/trades/load-trades";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { useEffect, useMemo, useState } from "react";

export function usePersistedTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [startingBalance, setStartingBalance] = useState(10_000);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = () => {
    setTrades(loadTrades());
    setStartingBalance(loadAccountSettings().startingBalance);
  };

  useEffect(() => {
    refresh();
    setIsLoaded(true);

    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
    };
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

  const handleUpdate = (id: string, data: TradeFormData) => {
    setTrades((prev) =>
      prev.map((trade) =>
        trade.id === id
          ? {
              ...data,
              id: trade.id,
              createdAt: trade.createdAt,
            }
          : trade
      )
    );
  };

  const handleDelete = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    trades,
    startingBalance,
    setStartingBalance,
    currentBalance,
    isLoaded,
    handleSubmit,
    handleUpdate,
    handleDelete,
  };
}
