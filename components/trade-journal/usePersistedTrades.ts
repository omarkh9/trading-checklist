"use client";

import { useAccounts } from "@/components/accounts/AccountProvider";
import {
  deleteTrade,
  fetchTrades,
  insertTrade,
  updateTrade,
} from "@/lib/supabase/trades";
import {
  balancesByAccount,
  computeCurrentBalance,
  fallbackAccountId,
  tradesForAccount,
} from "@/lib/trades/account-balance";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { useEffect, useMemo, useState } from "react";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function usePersistedTrades() {
  const {
    accounts,
    activeAccount,
    isLoaded: accountsLoaded,
    error: accountsError,
    setActiveAccountId,
  } = useAccounts();
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextTrades = await fetchTrades();
        if (cancelled) return;
        setAllTrades(nextTrades);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(errorMessage(cause));
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackId = fallbackAccountId(accounts);
  const activeAccountId = activeAccount?.id ?? "";

  const trades = useMemo(
    () => tradesForAccount(allTrades, activeAccountId, fallbackId),
    [allTrades, activeAccountId, fallbackId]
  );

  const startingBalance = activeAccount?.startingBalance ?? 0;

  const currentBalance = useMemo(
    () => computeCurrentBalance(startingBalance, trades),
    [startingBalance, trades]
  );

  const accountBalances = useMemo(
    () => balancesByAccount(accounts, allTrades),
    [accounts, allTrades]
  );

  const handleSubmit = async (data: TradeFormData) => {
    setError(null);
    const accountId = data.accountId || activeAccountId;
    try {
      const created = await insertTrade({ ...data, accountId });
      setAllTrades((prev) => [created, ...prev]);
      if (accountId && accountId !== activeAccountId) {
        setActiveAccountId(accountId);
      }
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
      setAllTrades((prev) =>
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
      setAllTrades((prev) => prev.filter((trade) => trade.id !== id));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return {
    trades,
    allTrades,
    accounts,
    activeAccount,
    startingBalance,
    currentBalance,
    accountBalances,
    isLoaded: isLoaded && accountsLoaded,
    error: error ?? accountsError,
    handleSubmit,
    handleUpdate,
    handleDelete,
  };
}
