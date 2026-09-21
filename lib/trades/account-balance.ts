import {
  ACCOUNT_STORAGE_KEY,
  TRADE_ACCOUNT_MAP_STORAGE_KEY,
} from "@/lib/storage/keys";
import {
  defaultAccountSettings,
  type AccountSettings,
  type TradingAccount,
} from "@/lib/types/account";
import type { Trade } from "@/lib/types/trade";
import { sumTradePnl } from "@/lib/trades/pnl";

export function loadAccountSettings(): AccountSettings {
  if (typeof window === "undefined") return defaultAccountSettings();
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return defaultAccountSettings();
    const parsed = JSON.parse(raw) as AccountSettings;
    return {
      startingBalance:
        typeof parsed.startingBalance === "number" &&
        Number.isFinite(parsed.startingBalance)
          ? parsed.startingBalance
          : defaultAccountSettings().startingBalance,
    };
  } catch {
    return defaultAccountSettings();
  }
}

export function saveAccountSettings(settings: AccountSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(settings));
}

export function computeCurrentBalance(
  startingBalance: number,
  trades: Trade[]
): number {
  return startingBalance + sumTradePnl(trades);
}

export function formatBalance(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fallbackAccountId(accounts: TradingAccount[]) {
  return accounts[0]?.id ?? "";
}

export function resolveTradeAccountId(
  trade: Pick<Trade, "accountId">,
  fallbackId: string
) {
  return trade.accountId || fallbackId;
}

export function tradesForAccount(
  trades: Trade[],
  accountId: string,
  fallbackId = accountId
) {
  if (!accountId) return trades;
  return trades.filter(
    (trade) => resolveTradeAccountId(trade, fallbackId) === accountId
  );
}

export function balancesByAccount(
  accounts: TradingAccount[],
  trades: Trade[]
): Record<string, number> {
  const fallbackId = fallbackAccountId(accounts);
  const result: Record<string, number> = {};
  for (const account of accounts) {
    result[account.id] = computeCurrentBalance(
      account.startingBalance,
      tradesForAccount(trades, account.id, fallbackId)
    );
  }
  return result;
}

export function readTradeAccountMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TRADE_ACCOUNT_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

export function writeTradeAccountMapEntry(tradeId: string, accountId: string) {
  if (typeof window === "undefined" || !tradeId || !accountId) return;
  const next = { ...readTradeAccountMap(), [tradeId]: accountId };
  localStorage.setItem(TRADE_ACCOUNT_MAP_STORAGE_KEY, JSON.stringify(next));
}

export function removeTradeAccountMapEntries(tradeIds: string[]) {
  if (typeof window === "undefined" || tradeIds.length === 0) return;
  const next = readTradeAccountMap();
  for (const id of tradeIds) delete next[id];
  localStorage.setItem(TRADE_ACCOUNT_MAP_STORAGE_KEY, JSON.stringify(next));
}
