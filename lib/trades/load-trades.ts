import {
  decodeNotesWithMeta,
  emptyJournalMeta,
} from "@/lib/trades/journal-meta";
import type { Trade } from "@/lib/types/trade";
import { dateKeyFromDate as localDateKeyFromDate, zonedDateKey } from "@/lib/time";

function toChartImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:image") ? value : null;
}

function preferRuleScore(
  primary: number | null,
  fallback: number | null
): number | null {
  if (primary != null && primary > 0) return primary;
  if (fallback != null && fallback > 0) return fallback;
  if (primary != null) return primary;
  return fallback;
}

export function normalizeTrade(trade: Trade): Trade {
  const decoded = decodeNotesWithMeta(trade.notes ?? "");
  const checkedRuleIds =
    trade.checkedRuleIds?.length > 0
      ? trade.checkedRuleIds
      : decoded.meta.checkedRuleIds;
  let ruleScore = preferRuleScore(trade.ruleScore, decoded.meta.ruleScore);
  if (ruleScore === 0 && checkedRuleIds.length > 0) {
    ruleScore = decoded.meta.ruleScore != null && decoded.meta.ruleScore > 0
      ? decoded.meta.ruleScore
      : null;
  }

  const meta = {
    ...emptyJournalMeta(),
    exitPrice: trade.exitPrice || decoded.meta.exitPrice,
    emotionBefore: trade.emotionBefore ?? decoded.meta.emotionBefore,
    emotionAfter: trade.emotionAfter ?? decoded.meta.emotionAfter,
    ruleScore,
    checkedRuleIds,
  };

  return {
    ...trade,
    higherTimeFrame: toChartImage(trade.higherTimeFrame),
    middleTimeFrame: toChartImage(trade.middleTimeFrame),
    lowerTimeFrame: toChartImage(trade.lowerTimeFrame),
    entry: toChartImage(trade.entry),
    exitPrice: meta.exitPrice ?? "",
    pnlMode: trade.pnlMode ?? "dollar",
    pnlInput: trade.pnlInput ?? "",
    pnlDollars: typeof trade.pnlDollars === "number" ? trade.pnlDollars : 0,
    riskSizeMode: trade.riskSizeMode ?? "percent",
    riskPercent: trade.riskPercent ?? "1",
    fixedLotSize: trade.fixedLotSize ?? "",
    lotSize: trade.lotSize ?? "",
    strategy: trade.strategy ?? "",
    notes: decoded.notes,
    emotionBefore: meta.emotionBefore,
    emotionAfter: meta.emotionAfter,
    ruleScore: meta.ruleScore,
    checkedRuleIds: meta.checkedRuleIds,
    accountBalanceAtEntry:
      typeof trade.accountBalanceAtEntry === "number"
        ? trade.accountBalanceAtEntry
        : 0,
    accountId: trade.accountId ?? "",
  };
}

export function tradeDateKey(iso: string): string {
  return zonedDateKey(iso);
}

export function dateKeyFromDate(date: Date): string {
  return localDateKeyFromDate(date);
}
