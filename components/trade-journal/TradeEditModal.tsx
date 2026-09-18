"use client";

import { TradeForm } from "@/components/trade-journal/TradeForm";
import { tradeToFormData } from "@/lib/trades/trade-form";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { X } from "lucide-react";
import { useEffect } from "react";

type TradeEditModalProps = {
  trade: Trade;
  currentBalance: number;
  onSave: (data: TradeFormData) => void;
  onClose: () => void;
};

export function TradeEditModal({
  trade,
  currentBalance,
  onSave,
  onClose,
}: TradeEditModalProps) {
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
        aria-label="Close edit trade"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-trade-title"
        className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[min(92vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl sm:inset-x-6"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h3 id="edit-trade-title" className="text-lg font-semibold text-zinc-100">
            Update Trade — {trade.pair}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-zinc-400 transition-colors hover:bg-surface-overlay hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <TradeForm
            key={trade.id}
            embedded
            currentBalance={currentBalance}
            initialData={tradeToFormData(trade)}
            submitLabel="Save Changes"
            onCancel={onClose}
            onSubmit={(data) => {
              onSave(data);
              onClose();
            }}
          />
        </div>
      </div>
    </>
  );
}
