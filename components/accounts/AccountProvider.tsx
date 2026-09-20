"use client";

import {
  createTradingAccount,
  deleteTradingAccount,
  loadTradingAccounts,
  readActiveAccountId,
  updateTradingAccount,
  writeActiveAccountId,
} from "@/lib/supabase/accounts";
import { deleteTradesForAccount } from "@/lib/supabase/trades";
import { fallbackAccountId } from "@/lib/trades/account-balance";
import {
  MAX_TRADING_ACCOUNTS,
  type TradingAccount,
} from "@/lib/types/account";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AccountContextValue = {
  accounts: TradingAccount[];
  activeAccount: TradingAccount | null;
  isLoaded: boolean;
  error: string | null;
  setActiveAccountId: (id: string) => void;
  createAccount: (input?: {
    name?: string;
    startingBalance?: number;
  }) => Promise<TradingAccount>;
  renameAccount: (id: string, name: string) => Promise<void>;
  updateStartingBalance: (id: string, startingBalance: number) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectAccount = useCallback((id: string, list: TradingAccount[]) => {
    const resolved =
      list.find((account) => account.id === id)?.id ?? fallbackAccountId(list);
    setActiveAccountIdState(resolved);
    if (resolved) writeActiveAccountId(resolved);
    return resolved;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await loadTradingAccounts();
        if (cancelled) return;
        setAccounts(next);
        selectAccount(readActiveAccountId(), next);
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
  }, [selectAccount]);

  const setActiveAccountId = useCallback(
    (id: string) => {
      selectAccount(id, accounts);
    },
    [accounts, selectAccount]
  );

  const createAccount = useCallback(
    async (input?: { name?: string; startingBalance?: number }) => {
      try {
        const created = await createTradingAccount(input);
        setAccounts((prev) => {
          const next = [...prev, created];
          selectAccount(created.id, next);
          return next;
        });
        setError(null);
        return created;
      } catch (cause) {
        const message = errorMessage(cause);
        setError(message);
        throw cause;
      }
    },
    [selectAccount]
  );

  const renameAccount = useCallback(async (id: string, name: string) => {
    try {
      const updated = await updateTradingAccount(id, { name });
      setAccounts((prev) =>
        prev.map((account) => (account.id === id ? updated : account))
      );
      setError(null);
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      throw cause;
    }
  }, []);

  const updateStartingBalance = useCallback(
    async (id: string, startingBalance: number) => {
      try {
        const updated = await updateTradingAccount(id, { startingBalance });
        setAccounts((prev) =>
          prev.map((account) => (account.id === id ? updated : account))
        );
        setError(null);
      } catch (cause) {
        const message = errorMessage(cause);
        setError(message);
        throw cause;
      }
    },
    []
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      try {
        const fallbackId = fallbackAccountId(
          accounts.filter((account) => account.id !== id)
        );
        await deleteTradesForAccount(id, fallbackAccountId(accounts));
        const remaining = await deleteTradingAccount(id);
        setAccounts(remaining);
        selectAccount(
          activeAccountId === id ? fallbackId : activeAccountId,
          remaining
        );
        setError(null);
      } catch (cause) {
        const message = errorMessage(cause);
        setError(message);
        throw cause;
      }
    },
    [accounts, activeAccountId, selectAccount]
  );

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId]
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      activeAccount,
      isLoaded,
      error,
      setActiveAccountId,
      createAccount,
      renameAccount,
      updateStartingBalance,
      deleteAccount,
    }),
    [
      accounts,
      activeAccount,
      isLoaded,
      error,
      setActiveAccountId,
      createAccount,
      renameAccount,
      updateStartingBalance,
      deleteAccount,
    ]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccounts must be used within AccountProvider.");
  }
  return context;
}

export { MAX_TRADING_ACCOUNTS };
