import { createClient, getAuthUser } from "@/lib/supabase/server";
import { formatCompactPnl } from "@/lib/trades/day-stats";
import { computeAnalyticsSummary, computeStrategyPerformance } from "@/lib/trades/analytics";
import { normalizeTrade } from "@/lib/trades/load-trades";
import { tradeFromRow } from "@/lib/supabase/trades";
import type { TradeRow } from "@/lib/supabase/database.types";
import { formatLocalDate } from "@/lib/time";
import type { Trade } from "@/lib/types/trade";

const RECENT_TRADE_LIMIT = 20;

function money(value: number) {
  return formatCompactPnl(value);
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`;
  return money(value);
}

export async function getTradesForUser(
  userId: string,
  options: { limit?: number; accountId?: string } = {}
): Promise<Trade[]> {
  const supabase = await createClient();
  let query = supabase
    .from("trades")
    .select(
      "id, user_id, pair, higher_time_frame, middle_time_frame, lower_time_frame, entry, direction, entry_price, stop_loss, take_profit, outcome, pnl_mode, pnl_input, pnl_dollars, risk_size_mode, risk_percent, fixed_lot_size, lot_size, account_balance_at_entry, strategy, notes, created_at, account_id, mt5_ticket"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? RECENT_TRADE_LIMIT);

  if (options.accountId) {
    query = query.eq("account_id", options.accountId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => normalizeTrade(tradeFromRow(row as TradeRow)));
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

export async function loadCoachInsights(accountId?: string) {
  const user = await getAuthUser();
  if (!user) return null;

  const trades = await getTradesForUser(user.id, {
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
