"use client";

import { ChatComposer } from "@/components/ai/ChatComposer";
import { ChatThread } from "@/components/ai/ChatThread";
import { useAiDesk } from "@/components/ai/AiDesk";
import { LifeBuoy, X } from "lucide-react";
import { usePathname } from "next/navigation";

const SUGGESTIONS = [
  "This page is not saving.",
  "Help me link MT5.",
  "I confirmed my email but cannot sign in.",
];

export function AiSupportWidget() {
  const pathname = usePathname();
  const { supportOpen, setSupportOpen, toggleSupport, support, context } =
    useAiDesk();

  if (pathname === "/coach") return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3">
      <div
        className={`pointer-events-auto w-[min(100vw-1.5rem,400px)] origin-bottom-right overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0c0c16] shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          supportOpen
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="flex h-[min(72vh,560px)] flex-col">
          <div className="flex items-center gap-3 border-b border-indigo-400/15 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
              <LifeBuoy className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                24/7 support
              </p>
              <h3 className="text-sm font-semibold text-zinc-100">
                Edge Log help
              </h3>
              <p className="truncate text-[11px] text-zinc-500">
                Reading {context.pathname || "/"}
                {context.accountName ? ` · ${context.accountName}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSupportOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close support"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {support.error ? (
            <p className="mx-4 mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {support.error}
            </p>
          ) : null}
          <ChatThread
            messages={support.messages}
            streaming={support.streaming}
            emptyTitle="Stuck? I already know the page."
            emptyBody="Route and session are in context. Describe the glitch and I'll walk the fix."
            suggestions={SUGGESTIONS}
            onSuggestion={(text) => void support.send(text)}
          />
          <ChatComposer
            placeholder="Describe the issue..."
            streaming={support.streaming}
            onSend={(text) => void support.send(text)}
            onStop={support.stop}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={toggleSupport}
        aria-expanded={supportOpen}
        aria-label={supportOpen ? "Close support" : "Open support"}
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.38)] transition-transform duration-200 hover:scale-105"
      >
        <span className="absolute inset-0 animate-ai-ring rounded-full ring-2 ring-emerald-300/40" />
        {supportOpen ? <X className="h-5 w-5" /> : <LifeBuoy className="h-5 w-5" />}
      </button>
    </div>
  );
}
