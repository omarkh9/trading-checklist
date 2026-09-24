"use client";

import { isEarlyExit } from "@/lib/trades/execution-variance";
import type { Trade } from "@/lib/types/trade";

type EarlyExitBadgeProps = {
  trade: Trade;
  className?: string;
};

export function EarlyExitBadge({ trade, className = "" }: EarlyExitBadgeProps) {
  if (!isEarlyExit(trade)) return null;

  return (
    <span
      title="Closed before take profit"
      className={`inline-flex max-w-full items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-400/40 ${className}`}
    >
      Early Exit
    </span>
  );
}
