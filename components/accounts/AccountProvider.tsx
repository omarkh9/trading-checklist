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
import { prefetchDeskCaches } from "@/lib/desk/prefetch";
import { fallbackAccountId } from "@/lib/trades/account-balance";
import {
  MAX_TRADING_ACCOUNTS,
  type TradingAccount,
  type TradingAccountMt5Patch,
} from "@/lib/types/account";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  updateMt5Link: (id: string, patch: TradingAccountMt5Patch) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
};

type AccountSwitcherValue = {
  accounts: { id: string; name: string }[];
  activeId: string;
  isLoaded: boolean;
  setActiveAccountId: (id: string) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);
const AccountSwitcherContext = createContext<AccountSwitcherValue | null>(null);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountsRef = useRef(accounts);
  const activeAccountIdRef = useRef(activeAccountId);
  accountsRef.current = accounts;
  activeAccountIdRef.current = activeAccountId;

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
      prefetchDeskCaches();
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

  const hasMt5Link = accounts.some((account) => account.mt5TokenSet);

  useEffect(() => {
    if (!hasMt5Link) return;

    let cancelled = false;
    const refresh = () => {
      void loadTradingAccounts({ force: true })
        .then((next) => {
          if (!cancelled) setAccounts(next);
        })
        .catch(() => {});
    };

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(refresh, 45_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [hasMt5Link]);

  const setActiveAccountId = useCallback(
    (id: string) => {
      selectAccount(id, accountsRef.current);
    },
    [selectAccount]
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

  const updateMt5Link = useCallback(
    async (id: string, patch: TradingAccountMt5Patch) => {
      try {
        const updated = await updateTradingAccount(id, patch);
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
        const list = accountsRef.current;
        const fallbackId = fallbackAccountId(
          list.filter((account) => account.id !== id)
        );
        await deleteTradesForAccount(id, fallbackAccountId(list));
        const remaining = await deleteTradingAccount(id);
        setAccounts(remaining);
        selectAccount(
          activeAccountIdRef.current === id
            ? fallbackId
            : activeAccountIdRef.current,
          remaining
        );
        setError(null);
      } catch (cause) {
        const message = errorMessage(cause);
        setError(message);
        throw cause;
      }
    },
    [selectAccount]
  );

  const activeAccount = useMemo(
    () =>
      accounts.find((account) => account.id === activeAccountId) ??
      accounts[0] ??
      null,
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
      updateMt5Link,
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
      updateMt5Link,
      deleteAccount,
    ]
  );

  const switcherKey = accounts
    .map((account) => `${account.id}:${account.name}`)
    .join("|");
  const switcherAccounts = useMemo(
    () => accounts.map(({ id, name }) => ({ id, name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by id/name, ignore balance updates
    [switcherKey]
  );

  const switcherValue = useMemo<AccountSwitcherValue>(
    () => ({
      accounts: switcherAccounts,
      activeId: activeAccountId,
      isLoaded,
      setActiveAccountId,
    }),
    [switcherAccounts, activeAccountId, isLoaded, setActiveAccountId]
  );

  return (
    <AccountContext.Provider value={value}>
      <AccountSwitcherContext.Provider value={switcherValue}>
        {children}
      </AccountSwitcherContext.Provider>
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccounts must be used within AccountProvider.");
  }
  return context;
}

export function useAccountSwitcher() {
  const context = useContext(AccountSwitcherContext);
  if (!context) {
    throw new Error("useAccountSwitcher must be used within AccountProvider.");
  }
  return context;
}

export { MAX_TRADING_ACCOUNTS };
