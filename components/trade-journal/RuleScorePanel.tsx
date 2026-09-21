"use client";

import { formatRuleScore } from "@/lib/trades/rule-score";
import type { ChecklistItem } from "@/lib/types/checklist";
import { desk } from "@/lib/ui/desk";
import { Check, Circle } from "lucide-react";

type RuleScorePanelProps = {
  items: ChecklistItem[];
  score: number | null;
  onToggle: (id: string) => void;
};

export function RuleScorePanel({ items, score, onToggle }: RuleScorePanelProps) {
  return (
    <div className={`${desk.panel} border-indigo-400/15`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Rule compliance</p>
          <p className="mt-1 text-xs text-zinc-500">
            Pulled from your Pre-Trade Checklist. Toggle any rule that applied to
            this setup.
          </p>
        </div>
        <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Score
          </p>
          <p className="font-mono text-lg font-semibold text-indigo-200">
            {formatRuleScore(score)}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Add rules on the Pre-Trade Checklist page to score this trade.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  item.checked
                    ? "border-emerald-400/25 bg-emerald-500/10 text-zinc-100"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-indigo-400/25"
                }`}
              >
                {item.checked ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-zinc-600" />
                )}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
