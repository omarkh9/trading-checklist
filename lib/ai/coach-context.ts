import { createClient, getAuthUser } from "@/lib/supabase/server";
import { formatCompactPnl } from "@/lib/trades/day-stats";
import { computeAnalyticsSummary, computeStrategyPerformance } from "@/lib/trades/analytics";
import {
  computeAdvancedAnalytics,
  formatAdvancedAnalyticsContext,
} from "@/lib/trades/advanced-analytics";
import { tradesForAccount } from "@/lib/trades/account-balance";
import { normalizeTrade } from "@/lib/trades/load-trades";
import { tradeFromRow } from "@/lib/supabase/trades";
import type { TradeRow } from "@/lib/supabase/database.types";
import { formatLocalDate } from "@/lib/time";
import type { Trade } from "@/lib/types/trade";

const RECENT_TRADE_LIMIT = 10;
const AUDIT_TRADE_LIMIT = 10;
const QUERY_CAP = 10;
const QUERY_TIMEOUT_MS = 2500;
const COACH_TRADE_COLUMNS =
  "id, pair, direction, entry_price, stop_loss, take_profit, outcome, pnl_dollars, strategy, notes, created_at, account_id, lot_size, risk_percent, account_balance_at_entry";

function money(value: number) {
  return formatCompactPnl(value);
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`;
  return money(value);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getTradesForUser(
  userId: string,
  options: { limit?: number; accountId?: string } = {}
): Promise<Trade[]> {
  const supabase = await createClient();
  const limit = Math.min(QUERY_CAP, options.limit ?? RECENT_TRADE_LIMIT);
  type TimedQuery = {
    data: Pick<TradeRow, "id">[] | null;
    error: { message: string } | null;
  };
  const query = supabase
    .from("trades")
    .select(COACH_TRADE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await withTimeout<TimedQuery>(
    Promise.resolve(query) as Promise<TimedQuery>,
    QUERY_TIMEOUT_MS,
    { data: null, error: { message: "trade_query_timeout" } }
  );

  if (error) {
    if (error.message !== "trade_query_timeout") {
      console.error("Full Supabase Error:", error);
    }
    return [];
  }

  const trades = (data ?? []).map((row) =>
    normalizeTrade(tradeFromRow(row as TradeRow))
  );
  const scoped = options.accountId
    ? tradesForAccount(trades, options.accountId, options.accountId)
    : trades;
  const usable = scoped.length > 0 ? scoped : trades;
  return usable.slice(0, limit);
}

export function formatTradeContext(trades: Trade[]): string {
  if (trades.length === 0) return "";
  return trades
    .map((trade) => {
      const setup = trade.strategy.replace(/^#/, "").trim() || "Untagged";
      return `Asset: ${trade.pair}, Type: ${trade.direction}, Outcome: ${trade.outcome}, P&L: ${signedMoney(trade.pnlDollars ?? 0)}, Date: ${formatLocalDate(trade.createdAt)}, Setup: ${setup}`;
    })
    .join("\n");
}

export async function loadCoachInsights(accountId?: string, userId?: string) {
  const id = userId ?? (await getAuthUser())?.id;
  if (!id) return null;

  const trades = await getTradesForUser(id, {
    limit: RECENT_TRADE_LIMIT,
    accountId,
  });

  if (trades.length === 0) {
    return "This desk has no logged trades yet. Help the trader define a clean first journal entry.";
  }

  const summary = computeAnalyticsSummary(trades);
  const strategies = computeStrategyPerformance(trades).slice(0, 4);
  const winRate =
    summary.tradeCount > 0
      ? Math.round((summary.wins / summary.tradeCount) * 100)
      : 0;

  const headline = [
    `Trades in this sample: ${summary.tradeCount}. Wins ${summary.wins}, losses ${summary.losses}, BE ${summary.breakevens}.`,
    `Win rate: ${winRate}%. Net P/L: ${signedMoney(summary.totalNetProfit)}.`,
    `Max drawdown: ${money(summary.maxDrawdown)}.`,
    strategies.length
      ? `Top setups: ${strategies
          .map(
            (item) =>
              `${item.name} (${item.trades} trades, ${Math.round(item.winRate)}% WR, ${signedMoney(item.netPnl)})`
          )
          .join("; ")}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    headline,
    "",
    "Recent trades:",
    formatTradeContext(trades),
  ].join("\n");
}

export async function loadAuditInsights(accountId?: string, userId?: string) {
  const id = userId ?? (await getAuthUser())?.id;
  if (!id) return null;

  const trades = await getTradesForUser(id, {
    limit: AUDIT_TRADE_LIMIT,
    accountId,
  });

  if (trades.length === 0) {
    return "This desk has no logged trades yet. Help the trader define a clean first journal entry before auditing behavior.";
  }

  const report = computeAdvancedAnalytics(trades);
  return [
    formatAdvancedAnalyticsContext(report),
    "",
    "Recent trades:",
    formatTradeContext(trades.slice(0, RECENT_TRADE_LIMIT)),
  ].join("\n");
}

export function fallbackAuditReply(insights: string | null, question: string) {
  const empty = !insights || insights.startsWith("This desk has no");
  if (empty) {
    return [
      "## Verdict",
      "No journal sample yet — there is nothing to audit.",
      "",
      "## Next 5 trades",
      "1. Log pair, direction, stop, and target before you size.",
      "2. Keep risk at or under 1% until the sample is readable.",
      "3. Tag the session and setup on every fill.",
      "4. Score the checklist honestly.",
      "5. Ask for another audit after five closed trades.",
    ].join("\n");
  }

  return [
    "## Verdict",
    "Local behavioral audit from your Supabase journal. Add `OPENAI_API_KEY` on the server to switch this to a live model.",
    "",
    "## Win-rate read",
    insights
      .split("\n")
      .filter((line) => /win rate|by direction/i.test(line))
      .map((line) => `- ${line}`)
      .join("\n") || "- See the snapshot below.",
    "",
    "## Session leaks",
    insights
      .split("\n")
      .filter((line) => /session|LEAK|Off session|London|Tokyo|Sydney|New York/i.test(line))
      .slice(0, 8)
      .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
      .join("\n"),
    "",
    "## Risk discipline",
    insights
      .split("\n")
      .filter((line) => /risk|rule score|stop|discipline/i.test(line))
      .slice(0, 8)
      .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
      .join("\n"),
    "",
    "## Next 5 trades",
    "1. Keep risk constant so the next sample is comparable.",
    "2. Avoid the flagged session unless the setup is A+.",
    "3. Do not move the stop closer after entry.",
    "4. Hold winners to the planned TP unless the thesis is invalid.",
    "5. Re-run this audit after those five closes.",
    "",
    question.trim() ? `You asked: *${question.trim()}*` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function fallbackCoachReply(insights: string | null, question: string) {
  const hasStats = Boolean(insights && !insights.startsWith("This desk has no"));
  return [
    hasStats
      ? "Here's a live read from your journal — streamed locally until an LLM key is configured."
      : "Your journal is ready for a first clean sample. I'll coach the process until live model access is configured.",
    "",
    hasStats && insights
      ? insights
          .split("\n")
          .filter(Boolean)
          .slice(0, 8)
          .map((line) => `- ${line}`)
          .join("\n")
      : "- Log pair, direction, invalidation, and target before you size.\n- Score the checklist honestly. A skipped rule is a data point, not a failure.",
    "",
    "**Next action**",
    question.trim()
      ? `You asked: *${question.trim()}*`
      : "Ask about edge, leaks, or the next setup.",
    "",
    "1. Review the last three losers for a shared leak (late entry, moved stop, skipped checklist).",
    "2. Keep risk constant for the next five trades so the sample is readable.",
    "3. After those five, ask me again and we'll mark what actually paid.",
    "",
    "Add `OPENAI_API_KEY` on the server to switch this coach from local insight to a live model.",
  ].join("\n");
}

export function fallbackSupportReply(pathname: string | undefined, question: string) {
  return [
    "I can see where you are and will walk the fix from there.",
    "",
    `**Current screen:** \`${pathname || "/"}\``,
    "",
    question.trim()
      ? `You wrote: *${question.trim()}*`
      : "Tell me the exact error text or what you expected to happen.",
    "",
    "**Quick checks**",
    "- Refresh once, then retry the same click — session cookies should already be on this origin.",
    "- If a save failed, confirm you are signed in and an account is selected in the header switcher.",
    "- MT5: Settings → the account → link, then wait for the webhook to post a ticket.",
    "- Auth: open the latest confirmation email, then sign in with the same address in lowercase.",
    "",
    "Add `OPENAI_API_KEY` to enable a live support model. Until then I still stream this playbook so you are not stuck on a spinner.",
  ].join("\n");
}
