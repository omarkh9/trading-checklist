import { parseNumericInput } from "@/lib/trades/pnl";
import { isShortDirection } from "@/lib/trades/contract-math";
import { resolveAsset } from "@/lib/trades/assets";
import type { Trade } from "@/lib/types/trade";

export function isEarlyExit(trade: Pick<
  Trade,
  "outcome" | "direction" | "exitPrice" | "takeProfit" | "pair"
>): boolean {
  if (trade.outcome !== "Win") return false;

  const exit = parseNumericInput(trade.exitPrice);
  const takeProfit = parseNumericInput(trade.takeProfit);
  if (exit == null || takeProfit == null) return false;

  const tick = resolveAsset(trade.pair).spec.tickSize;
  const tolerance = Number.isFinite(tick) && tick > 0 ? tick : 0;

  if (isShortDirection(trade.direction)) {
    return exit > takeProfit + tolerance;
  }
  return exit < takeProfit - tolerance;
}
