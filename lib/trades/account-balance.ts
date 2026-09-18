import { ACCOUNT_STORAGE_KEY } from "@/lib/storage/keys";
import {
  defaultAccountSettings,
  type AccountSettings,
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
