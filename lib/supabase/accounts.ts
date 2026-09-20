import { createClient } from "@/lib/supabase/client";
import type {
  TradingAccountInsert,
  TradingAccountRow,
} from "@/lib/supabase/database.types";
import {
  ACCOUNT_STORAGE_KEY,
  ACTIVE_ACCOUNT_STORAGE_KEY,
  TRADE_ACCOUNTS_BACKFILL_STORAGE_KEY,
  TRADING_ACCOUNTS_STORAGE_KEY,
} from "@/lib/storage/keys";
import {
  DEFAULT_ACCOUNT_NAME,
  DEFAULT_STARTING_BALANCE,
  MAX_TRADING_ACCOUNTS,
  nextAccountName,
  normalizeAccountName,
  type TradingAccount,
} from "@/lib/types/account";
import {
  loadAccountSettings,
  readTradeAccountMap,
  writeTradeAccountMapEntry,
} from "@/lib/trades/account-balance";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function isMissingAccountsTable(error: { message: string } | null) {
  const message = error?.message.toLowerCase() ?? "";
  return (
    message.includes("schema cache") ||
    message.includes("trading_accounts") ||
    (message.includes("does not exist") && message.includes("account"))
  );
}

async function requireUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  throwIfError(error);
  if (!user) throw new Error("You must be signed in to manage trading accounts.");
  return { supabase, userId: user.id };
}

function accountFromRow(row: TradingAccountRow): TradingAccount {
  return {
    id: row.id,
    name: row.name,
    startingBalance: row.starting_balance,
    createdAt: row.created_at,
  };
}

function sortAccounts(accounts: TradingAccount[]) {
  return [...accounts].sort((a, b) => {
    const created = a.createdAt.localeCompare(b.createdAt);
    if (created !== 0) return created;
    return a.name.localeCompare(b.name);
  });
}

function readLocalAccounts(): TradingAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRADING_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TradingAccount[];
    if (!Array.isArray(parsed)) return [];
    return sortAccounts(
      parsed
        .map((account) => ({
          id: typeof account.id === "string" ? account.id : "",
          name: normalizeAccountName(account.name ?? ""),
          startingBalance:
            typeof account.startingBalance === "number" &&
            Number.isFinite(account.startingBalance) &&
            account.startingBalance >= 0
              ? account.startingBalance
              : DEFAULT_STARTING_BALANCE,
          createdAt:
            typeof account.createdAt === "string"
              ? account.createdAt
              : new Date().toISOString(),
        }))
        .filter((account) => account.id && account.name)
    );
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: TradingAccount[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    TRADING_ACCOUNTS_STORAGE_KEY,
    JSON.stringify(sortAccounts(accounts))
  );
}

let cachedAccounts: TradingAccount[] | null = null;
let accountsInflight: Promise<TradingAccount[]> | null = null;
let tradeAccountsReconciled = false;

function rememberAccounts(accounts: TradingAccount[]) {
  const next = sortAccounts(accounts);
  cachedAccounts = next;
  writeLocalAccounts(next);
  return next;
}

export function clearAccountsCache() {
  cachedAccounts = null;
  accountsInflight = null;
  tradeAccountsReconciled = false;
}

async function getExistingAccounts(): Promise<TradingAccount[]> {
  if (cachedAccounts && cachedAccounts.length > 0) return cachedAccounts;
  const local = readLocalAccounts();
  if (local.length > 0) {
    cachedAccounts = local;
    return local;
  }
  return loadTradingAccounts();
}

function defaultLocalAccount(): TradingAccount {
  return {
    id: crypto.randomUUID(),
    name: DEFAULT_ACCOUNT_NAME,
    startingBalance: loadAccountSettings().startingBalance,
    createdAt: new Date().toISOString(),
  };
}

function ensureLocalAccounts(): TradingAccount[] {
  const existing = readLocalAccounts();
  if (existing.length > 0) return existing;
  const created = [defaultLocalAccount()];
  writeLocalAccounts(created);
  return created;
}

export function readActiveAccountId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) ?? "";
}

export function writeActiveAccountId(accountId: string) {
  if (typeof window === "undefined" || !accountId) return;
  localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
}

async function syncMappedTradeAccounts(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const map = readTradeAccountMap();
  const byAccount = new Map<string, string[]>();
  for (const [tradeId, accountId] of Object.entries(map)) {
    if (!tradeId || !accountId) continue;
    const list = byAccount.get(accountId) ?? [];
    list.push(tradeId);
    byAccount.set(accountId, list);
  }

  for (const [accountId, tradeIds] of byAccount) {
    const { error } = await supabase
      .from("trades")
      .update({ account_id: accountId })
      .eq("user_id", userId)
      .in("id", tradeIds);
    if (error && isMissingAccountsTable(error)) return;
    if (error) {
      const message = error.message.toLowerCase();
      if (!message.includes("account_id")) throwIfError(error);
      return;
    }
  }
}

async function backfillTradeAccounts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accountId: string
) {
  if (!accountId) return;
  const { error } = await supabase
    .from("trades")
    .update({ account_id: accountId })
    .eq("user_id", userId)
    .is("account_id", null);
  if (error && !isMissingAccountsTable(error)) {
    const message = error.message.toLowerCase();
    if (!message.includes("account_id")) throwIfError(error);
  }
}

async function maybeReconcileTradeAccounts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accountId: string
) {
  if (tradeAccountsReconciled) return;

  const map = readTradeAccountMap();
  if (Object.keys(map).length > 0) {
    await syncMappedTradeAccounts(supabase, userId);
  }

  const alreadyBackfilled =
    typeof window !== "undefined" &&
    localStorage.getItem(TRADE_ACCOUNTS_BACKFILL_STORAGE_KEY) === "1";

  if (!alreadyBackfilled) {
    await backfillTradeAccounts(supabase, userId, accountId);
    if (typeof window !== "undefined") {
      localStorage.setItem(TRADE_ACCOUNTS_BACKFILL_STORAGE_KEY, "1");
    }
  }

  tradeAccountsReconciled = true;
}

function remapTradeAccounts(fromId: string, toId: string) {
  if (!fromId || !toId || fromId === toId) return;
  const map = readTradeAccountMap();
  for (const [tradeId, accountId] of Object.entries(map)) {
    if (accountId === fromId) writeTradeAccountMapEntry(tradeId, toId);
  }
  if (readActiveAccountId() === fromId) writeActiveAccountId(toId);
}

async function insertRemoteAccount(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  account: Pick<TradingAccount, "id" | "name" | "startingBalance" | "createdAt">
) {
  const payload: TradingAccountInsert = {
    id: account.id,
    user_id: userId,
    name: account.name,
    starting_balance: account.startingBalance,
    created_at: account.createdAt,
  };
  const { data, error } = await supabase
    .from("trading_accounts")
    .insert(payload)
    .select()
    .single();
  if (isMissingAccountsTable(error)) return null;
  throwIfError(error);
  return data ? accountFromRow(data) : null;
}

export async function loadTradingAccounts(): Promise<TradingAccount[]> {
  if (cachedAccounts && cachedAccounts.length > 0) return cachedAccounts;
  if (accountsInflight) return accountsInflight;

  accountsInflight = loadTradingAccountsFromNetwork().finally(() => {
    accountsInflight = null;
  });
  return accountsInflight;
}

async function loadTradingAccountsFromNetwork(): Promise<TradingAccount[]> {
  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (isMissingAccountsTable(error)) {
    return rememberAccounts(ensureLocalAccounts());
  }
  throwIfError(error);

  if (data && data.length > 0) {
    const accounts = sortAccounts(data.map(accountFromRow));
    const remoteIds = new Set(accounts.map((account) => account.id));

    for (const local of readLocalAccounts()) {
      if (remoteIds.has(local.id)) continue;
      const duplicate = accounts.find(
        (account) => account.name.toLowerCase() === local.name.toLowerCase()
      );
      if (duplicate) {
        remapTradeAccounts(local.id, duplicate.id);
        continue;
      }
      if (accounts.length >= MAX_TRADING_ACCOUNTS) break;
      const row = await insertRemoteAccount(supabase, userId, local);
      if (!row) break;
      accounts.push(row);
      remoteIds.add(row.id);
    }

    const merged = rememberAccounts(accounts);
    await maybeReconcileTradeAccounts(supabase, userId, merged[0].id);
    return merged;
  }

  const local = ensureLocalAccounts();
  const inserted: TradingAccount[] = [];
  for (const account of local) {
    const row = await insertRemoteAccount(supabase, userId, account);
    if (!row) return rememberAccounts(local);
    inserted.push(row);
  }

  const accounts = rememberAccounts(inserted.length > 0 ? inserted : local);
  await maybeReconcileTradeAccounts(supabase, userId, accounts[0]?.id ?? "");
  return accounts;
}

export async function createTradingAccount(input?: {
  name?: string;
  startingBalance?: number;
}): Promise<TradingAccount> {
  const existing = await getExistingAccounts();
  if (existing.length >= MAX_TRADING_ACCOUNTS) {
    throw new Error(`You can keep up to ${MAX_TRADING_ACCOUNTS} trading accounts.`);
  }

  const name = normalizeAccountName(input?.name || nextAccountName(existing));
  if (!name) throw new Error("Account name is required.");
  if (
    existing.some((account) => account.name.toLowerCase() === name.toLowerCase())
  ) {
    throw new Error("An account with that name already exists.");
  }

  const startingBalance =
    typeof input?.startingBalance === "number" &&
    Number.isFinite(input.startingBalance) &&
    input.startingBalance >= 0
      ? input.startingBalance
      : DEFAULT_STARTING_BALANCE;

  const draft: TradingAccount = {
    id: crypto.randomUUID(),
    name,
    startingBalance,
    createdAt: new Date().toISOString(),
  };

  const { supabase, userId } = await requireUserId();
  const remote = await insertRemoteAccount(supabase, userId, draft);
  const created = remote ?? draft;
  rememberAccounts([...existing, created]);
  return created;
}

export async function updateTradingAccount(
  id: string,
  patch: { name?: string; startingBalance?: number }
): Promise<TradingAccount> {
  const existing = await getExistingAccounts();
  const current = existing.find((account) => account.id === id);
  if (!current) throw new Error("Trading account not found.");

  const name =
    patch.name != null ? normalizeAccountName(patch.name) : current.name;
  if (!name) throw new Error("Account name is required.");
  if (
    existing.some(
      (account) =>
        account.id !== id && account.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error("An account with that name already exists.");
  }

  const startingBalance =
    patch.startingBalance != null &&
    Number.isFinite(patch.startingBalance) &&
    patch.startingBalance >= 0
      ? patch.startingBalance
      : current.startingBalance;

  const next: TradingAccount = { ...current, name, startingBalance };
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("trading_accounts")
    .update({
      name: next.name,
      starting_balance: next.startingBalance,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error && !isMissingAccountsTable(error)) throwIfError(error);

  const accounts = rememberAccounts(
    existing.map((account) => (account.id === id ? next : account))
  );
  if (accounts[0]?.id === id) {
    localStorage.setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify({ startingBalance: next.startingBalance })
    );
  }
  return next;
}

export async function deleteTradingAccount(id: string): Promise<TradingAccount[]> {
  const existing = await getExistingAccounts();
  if (existing.length <= 1) {
    throw new Error("Keep at least one trading account.");
  }
  if (!existing.some((account) => account.id === id)) {
    throw new Error("Trading account not found.");
  }

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("trading_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error && !isMissingAccountsTable(error)) throwIfError(error);

  return rememberAccounts(existing.filter((account) => account.id !== id));
}
