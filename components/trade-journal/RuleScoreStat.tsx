"use client";

import {
  formatRuleScoreCaption,
  ruleScoreToneClass,
} from "@/lib/trades/rule-score";
import { ListChecks } from "lucide-react";

type RuleScoreStatProps = {
  score: number | null;
  size?: "lg" | "sm";
};

export function RuleScoreStat({ score, size = "lg" }: RuleScoreStatProps) {
  const tone = ruleScoreToneClass(score);
  const caption = formatRuleScoreCaption(score);
  const width =
    score == null || !Number.isFinite(score)
      ? 0
      : Math.max(0, Math.min(100, Math.round(score)));

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tone.badge}`}
        title="Pre-Trade Checklist rule score saved with this trade"
      >
        <ListChecks className="h-3.5 w-3.5" />
        {caption}
      </span>
    );
  }

  return (
    <div
      className={`flex h-full flex-col rounded-lg border px-4 py-3 ${tone.card}`}
      title="Exact Pre-Trade Checklist score stored when this trade was submitted"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Pre-Trade Checklist
      </p>
      <p className={`mt-1 flex items-center gap-2 font-mono text-lg font-semibold leading-tight ${tone.text}`}>
        <ListChecks className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{caption}</span>
      </p>
      <div className="mt-auto pt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${tone.bar}`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}
