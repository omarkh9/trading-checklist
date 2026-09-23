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

export function SupportHeaderButton() {
  const pathname = usePathname();
  const { supportOpen, toggleSupport } = useAiDesk();
  if (pathname === "/coach") return null;

  return (
    <button
      type="button"
      onClick={toggleSupport}
      aria-pressed={supportOpen}
      className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all duration-300 ${
        supportOpen
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
          : "border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-white"
      }`}
    >
      <LifeBuoy className="h-4 w-4" />
      <span className="hidden sm:inline">Help</span>
    </button>
  );
}

export function AiSupportWidget() {
  const pathname = usePathname();
  const { supportOpen, setSupportOpen, support, context } = useAiDesk();

  if (pathname === "/coach" || !supportOpen) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close support"
        onClick={() => setSupportOpen(false)}
        className="pointer-events-auto absolute inset-0 bg-black/40"
      />
      <div className="pointer-events-auto absolute bottom-4 right-4 flex h-[min(64vh,520px)] w-[min(calc(100vw-2rem),360px)] flex-col overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0c0c16] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-indigo-400/15 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <LifeBuoy className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              24/7 support
            </p>
            <h3 className="text-sm font-semibold text-zinc-100">Edge Log help</h3>
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
  );
}
