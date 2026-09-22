"use client";

import { MarkdownMessage } from "@/components/ai/MarkdownMessage";
import type { AiChatMessage } from "@/lib/ai/types";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

type ChatThreadProps = {
  messages: AiChatMessage[];
  streaming: boolean;
  emptyTitle: string;
  emptyBody: string;
  suggestions: string[];
  onSuggestion: (text: string) => void;
};

export function ChatThread({
  messages,
  streaming,
  emptyTitle,
  emptyBody,
  suggestions,
  onSuggestion,
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stickRef.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  return (
    <div
      ref={scrollerRef}
      onScroll={() => {
        const node = scrollerRef.current;
        if (!node) return;
        stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 72;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-400/30">
            <Sparkles className="h-5 w-5 text-indigo-300" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">{emptyTitle}</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            {emptyBody}
          </p>
          <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onSuggestion(item)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-zinc-300 transition-all duration-200 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLast = index === messages.length - 1;
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"} animate-ai-rise`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${
                    isUser
                      ? "rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-500 text-sm text-white"
                      : "rounded-bl-md border border-white/10 bg-white/[0.04] text-zinc-200"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  ) : (
                    <MarkdownMessage
                      content={message.content}
                      streaming={streaming && isLast}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
