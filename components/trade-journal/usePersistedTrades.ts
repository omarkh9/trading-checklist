"use client";

import { useAccounts } from "@/components/accounts/AccountProvider";
import { useCachedTrades } from "@/components/trade-journal/useCachedTrades";
import {
  deleteTrade,
  insertTrade,
  updateTrade,
} from "@/lib/supabase/trades";
import {
  balancesByAccount,
  computeCurrentBalance,
  fallbackAccountId,
  tradesForAccount,
} from "@/lib/trades/account-balance";
import type { TradeFormData } from "@/lib/types/trade";
import { useCallback, useMemo, useState } from "react";

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
  const {
    trades: allTrades,
    isLoaded: tradesLoaded,
    error: tradesError,
  } = useCachedTrades();
  const [mutationError, setMutationError] = useState<string | null>(null);

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

  const handleSubmit = useCallback(
    async (data: TradeFormData) => {
      setMutationError(null);
      const accountId = data.accountId || activeAccountId;
      try {
        await insertTrade({ ...data, accountId });
        if (accountId && accountId !== activeAccountId) {
          setActiveAccountId(accountId);
        }
      } catch (cause) {
        const message = errorMessage(cause);
        setMutationError(message);
        throw cause;
      }
    },
    [activeAccountId, setActiveAccountId]
  );

  const handleUpdate = useCallback(async (id: string, data: TradeFormData) => {
    setMutationError(null);
    try {
      await updateTrade(id, data);
    } catch (cause) {
      const message = errorMessage(cause);
      setMutationError(message);
      throw cause;
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setMutationError(null);
    try {
      await deleteTrade(id);
    } catch (cause) {
      setMutationError(errorMessage(cause));
    }
  }, []);

  return {
    trades,
    allTrades,
    accounts,
    activeAccount,
    startingBalance,
    currentBalance,
    accountBalances,
    isLoaded: tradesLoaded && accountsLoaded,
    error: mutationError ?? tradesError ?? accountsError,
    handleSubmit,
    handleUpdate,
    handleDelete,
  };
}
