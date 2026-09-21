"use client";

import { TradeDetailCard } from "@/components/trade-journal/TradeDetailCard";
import { RuleScoreStat } from "@/components/trade-journal/RuleScoreStat";
import type { Trade } from "@/lib/types/trade";
import { X } from "lucide-react";
import { useEffect } from "react";

type TradeDetailModalProps = {
  trade: Trade;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export function TradeDetailModal({
  trade,
  title = "Trade Details",
  subtitle,
  onClose,
}: TradeDetailModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close trade details"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-detail-title"
        className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[min(92vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-indigo-400/25 bg-[#0c0c16] shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:inset-x-6"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-indigo-400/15 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="trade-detail-title" className="text-lg font-semibold text-zinc-100">
                {title}
              </h3>
              <RuleScoreStat score={trade.ruleScore} size="sm" />
            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <TradeDetailCard trade={trade} />
        </div>
      </div>
    </>
  );
}
