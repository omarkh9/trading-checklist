"use client";

import {
  createTradingAccount,
  deleteTradingAccount,
  ensureTradingAccountPersisted,
  linkMt5Account,
  loadTradingAccounts,
  readActiveAccountId,
  syncMt5AccountHistory,
  unlinkMt5Account,
  updateTradingAccount,
  writeActiveAccountId,
} from "@/lib/supabase/accounts";
import { deleteTradesForAccount, fetchTrades } from "@/lib/supabase/trades";
import { prefetchDeskCaches } from "@/lib/desk/prefetch";
import { fallbackAccountId } from "@/lib/trades/account-balance";
import {
  MAX_TRADING_ACCOUNTS,
  type TradingAccount,
  type TradingAccountMt5Credentials,
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
  linkMt5Account: (
    id: string,
    credentials: TradingAccountMt5Credentials
  ) => Promise<void>;
  unlinkMt5Account: (id: string) => Promise<void>;
  syncMt5Account: (id: string) => Promise<number>;
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

// Pull fresh broker data in the background while the app is open. A short
// window keeps it light; "Sync history" still backfills the full year.
const AUTO_SYNC_INTERVAL_MS = 5 * 60_000;
const AUTO_SYNC_DAYS = 7;

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountsRef = useRef(accounts);
  const activeAccountIdRef = useRef(activeAccountId);
  const autoSyncRef = useRef({ running: false, lastAttempt: 0 });
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
        const resolved = selectAccount(readActiveAccountId(), next);
        if (resolved) void ensureTradingAccountPersisted(resolved);
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
      void Promise.all([
        loadTradingAccounts({ force: true }).then((next) => {
          if (!cancelled) setAccounts(next);
        }),
        fetchTrades({ force: true }),
      ]).catch(() => {});
    };

    const autoSync = () => {
      if (document.visibilityState !== "visible") return;
      const list = accountsRef.current;
      const account =
        list.find((item) => item.id === activeAccountIdRef.current) ?? list[0];
      if (!account?.mt5TokenSet) return;

      const state = autoSyncRef.current;
      const lastSynced = Date.parse(account.mt5SyncedAt ?? "") || 0;
      const now = Date.now();
      if (
        state.running ||
        now - Math.max(lastSynced, state.lastAttempt) < AUTO_SYNC_INTERVAL_MS
      ) {
        return;
      }

      state.running = true;
      state.lastAttempt = now;
      void syncMt5AccountHistory(account.id, undefined, { days: AUTO_SYNC_DAYS })
        .then(async (result) => {
          if (!cancelled) setAccounts(result.accounts);
          await fetchTrades({ force: true });
        })
        .catch((cause) => {
          // Stay quiet in the background; "Last sync" shows staleness and the
          // manual "Sync history" button reports the error.
          console.warn("MT5 auto-sync failed:", errorMessage(cause));
        })
        .finally(() => {
          state.running = false;
        });
    };

    const tick = () => {
      refresh();
      autoSync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };

    autoSync();
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(tick, 45_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [hasMt5Link]);

  const setActiveAccountId = useCallback(
    (id: string) => {
      const resolved = selectAccount(id, accountsRef.current);
      if (resolved) void ensureTradingAccountPersisted(resolved);
    },
    [selectAccount]
  );

  const createAccount = useCallback(
    async (input?: { name?: string; startingBalance?: number }) => {
      try {
        const created = await createTradingAccount(input);
        setAccounts((prev) => {
          const next = prev.some((account) => account.id === created.id)
            ? prev.map((account) => (account.id === created.id ? created : account))
            : [...prev, created];
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

  const connectMt5Account = useCallback(
    async (id: string, credentials: TradingAccountMt5Credentials) => {
      try {
        const result = await linkMt5Account(id, credentials);
        setAccounts(result.accounts);
        selectAccount(result.accountId, result.accounts);
        await fetchTrades({ force: true });
        setError(result.syncError);
      } catch (cause) {
        const message = errorMessage(cause);
        setError(message);
        throw cause;
      }
    },
    [selectAccount]
  );

  const syncMt5Account = useCallback(async (id: string) => {
    try {
      const result = await syncMt5AccountHistory(id);
      setAccounts(result.accounts);
      await fetchTrades({ force: true });
      setError(null);
      return result.ingested;
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      throw cause;
    }
  }, []);

  const disconnectMt5Account = useCallback(async (id: string) => {
    try {
      const next = await unlinkMt5Account(id);
      setAccounts(next);
      setError(null);
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      throw cause;
    }
  }, []);

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
      linkMt5Account: connectMt5Account,
      unlinkMt5Account: disconnectMt5Account,
      syncMt5Account,
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
      connectMt5Account,
      disconnectMt5Account,
      syncMt5Account,
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
