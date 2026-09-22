"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef } from "react";

type ChatComposerProps = {
  placeholder: string;
  streaming: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

export function ChatComposer({
  placeholder,
  streaming,
  disabled,
  onSend,
  onStop,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  });

  const submit = () => {
    const value = ref.current?.value ?? "";
    if (!value.trim() || streaming || disabled) return;
    onSend(value);
    if (ref.current) {
      ref.current.value = "";
      ref.current.style.height = "auto";
    }
  };

  return (
    <form
      className="border-t border-indigo-400/15 bg-[#0c0c16]/90 p-3 backdrop-blur-sm"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-200 focus-within:border-indigo-400/45 focus-within:bg-indigo-500/[0.06]">
        <textarea
          ref={ref}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200 transition-all duration-200 hover:bg-rose-500/25"
            aria-label="Stop response"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)] transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-2 px-1 text-[11px] text-zinc-600">
        Enter to send · Shift+Enter for a new line
      </p>
    </form>
  );
}
