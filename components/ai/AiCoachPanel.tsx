"use client";

import { ChatComposer } from "@/components/ai/ChatComposer";
import { ChatThread } from "@/components/ai/ChatThread";
import { useAiDesk } from "@/components/ai/AiDesk";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Sparkles, Trash2, X } from "lucide-react";

const SUGGESTIONS = [
  "What's my edge in the last sample?",
  "Where am I leaking P/L?",
  "Prep a process for the next trade.",
];

type AiCoachPanelProps = {
  variant: "dock" | "page" | "overlay";
  onClose?: () => void;
};

export function AiCoachPanel({ variant, onClose }: AiCoachPanelProps) {
  const { coach, context } = useAiDesk();
  const confirm = useConfirm();

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0c16]">
      <div className="flex shrink-0 items-center gap-3 border-b border-indigo-400/15 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 ring-1 ring-indigo-400/30">
          <Sparkles className="h-5 w-5 text-indigo-200" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Live coach
          </p>
          <h3 className="truncate text-sm font-semibold text-zinc-100">
            AI performance desk
          </h3>
          <p className="truncate text-[11px] text-zinc-500">
            {context.pageTitle}
            {context.accountName ? ` · ${context.accountName}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void confirm({
              title: "Clear this conversation?",
              description:
                "Coach messages in this session will be removed.",
              confirmLabel: "Yes, Clear",
            }).then((ok) => {
              if (ok) coach.clear();
            });
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          aria-label="Clear conversation"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close coach"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {coach.error ? (
        <p className="mx-4 mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {coach.error}
        </p>
      ) : null}

      <ChatThread
        messages={coach.messages}
        streaming={coach.streaming}
        emptyTitle="Your private trading coach"
        emptyBody="Ask about edge, leaks, or the next setup. I already have this page and your journal snapshot."
        suggestions={SUGGESTIONS}
        onSuggestion={(text) => void coach.send(text)}
      />
      <ChatComposer
        placeholder={
          variant === "page"
            ? "Ask the coach about your journal..."
            : "Ask the coach..."
        }
        streaming={coach.streaming}
        onSend={(text) => void coach.send(text)}
        onStop={coach.stop}
      />
    </div>
  );
}
