"use client";

import {
  TRADE_EMOTIONS,
  type TradeEmotion,
} from "@/lib/types/emotion";
import { desk } from "@/lib/ui/desk";

type EmotionPickerProps = {
  label: string;
  hint?: string;
  value: TradeEmotion | null;
  onChange: (value: TradeEmotion | null) => void;
};

export function EmotionPicker({
  label,
  hint,
  value,
  onChange,
}: EmotionPickerProps) {
  return (
    <div>
      <p className={desk.label}>{label}</p>
      {hint && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {TRADE_EMOTIONS.map((emotion) => {
          const selected = value === emotion.id;
          return (
            <button
              key={emotion.id}
              type="button"
              onClick={() => onChange(selected ? null : emotion.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                selected
                  ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-indigo-400/30 hover:text-zinc-200"
              }`}
              aria-pressed={selected}
            >
              <span aria-hidden>{emotion.emoji}</span>
              {emotion.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
