import { TRADES_STORAGE_KEY } from "@/lib/storage/keys";
import type { Trade } from "@/lib/types/trade";

function toChartImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:image") ? value : null;
}

export function normalizeTrade(trade: Trade): Trade {
  return {
    ...trade,
    higherTimeFrame: toChartImage(trade.higherTimeFrame),
    middleTimeFrame: toChartImage(trade.middleTimeFrame),
    lowerTimeFrame: toChartImage(trade.lowerTimeFrame),
    entry: toChartImage(trade.entry),
  };
}

export function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRADES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Trade[]) : [];
    return parsed.map(normalizeTrade);
  } catch {
    return [];
  }
}

export function tradeDateKey(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
