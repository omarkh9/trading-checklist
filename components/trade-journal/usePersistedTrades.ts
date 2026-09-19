"use client";

import {
  deleteTrade,
  fetchTrades,
  insertTrade,
  updateTrade,
} from "@/lib/supabase/trades";
import {
  computeCurrentBalance,
  loadAccountSettings,
  saveAccountSettings,
} from "@/lib/trades/account-balance";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function usePersistedTrades() {
  const { user } = useUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [startingBalance, setStartingBalance] = useState(10_000);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextTrades = await fetchTrades();
        if (cancelled) return;
        setTrades(nextTrades);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(errorMessage(cause));
      } finally {
        if (cancelled) return;
        setStartingBalance(loadAccountSettings().startingBalance);
        setIsLoaded(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveAccountSettings({ startingBalance });
  }, [startingBalance, isLoaded]);

  const currentBalance = useMemo(
    () => computeCurrentBalance(startingBalance, trades),
    [startingBalance, trades]
  );

  const handleSubmit = async (data: TradeFormData) => {
    setError(null);
    try {
      const created = await insertTrade(data, user?.id ?? null);
      setTrades((prev) => [created, ...prev]);
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      throw cause;
    }
  };

  const handleUpdate = async (id: string, data: TradeFormData) => {
    setError(null);
    try {
      const updated = await updateTrade(id, data);
      setTrades((prev) =>
        prev.map((trade) => (trade.id === id ? updated : trade))
      );
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      throw cause;
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteTrade(id);
      setTrades((prev) => prev.filter((trade) => trade.id !== id));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return {
    trades,
    startingBalance,
    setStartingBalance,
    currentBalance,
    isLoaded,
    error,
    handleSubmit,
    handleUpdate,
    handleDelete,
  };
}
