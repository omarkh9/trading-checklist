"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Yes, Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="absolute left-1/2 top-1/2 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-rose-400/25 bg-[#0c0c16] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-lg font-semibold text-zinc-100">
              {title}
            </h3>
            {description ? (
              <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(225,29,72,0.28)] transition-all duration-300 hover:bg-rose-500 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
