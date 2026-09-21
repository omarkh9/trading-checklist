import type { ChecklistItem, ChecklistRule } from "@/lib/types/checklist";

export function computeRuleScore(
  rules: Array<Pick<ChecklistRule, "id">>,
  checkedRuleIds: string[]
): number | null {
  if (rules.length === 0) return null;
  const checked = new Set(checkedRuleIds);
  const hits = rules.reduce(
    (count, rule) => count + (checked.has(rule.id) ? 1 : 0),
    0
  );
  return Math.round((hits / rules.length) * 100);
}

export function formatRuleScore(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return `${Math.round(score)}%`;
}

export function formatRuleScoreCaption(score: number | null): string {
  return `Rule Score: ${formatRuleScore(score)}`;
}

export function ruleScoreToneClass(score: number | null): {
  card: string;
  text: string;
  badge: string;
  bar: string;
} {
  if (score == null || !Number.isFinite(score)) {
    return {
      card: "border-white/10 bg-white/[0.03]",
      text: "text-zinc-400",
      badge: "bg-white/5 text-zinc-400 ring-white/15",
      bar: "bg-zinc-500",
    };
  }
  if (score >= 80) {
    return {
      card: "border-emerald-400/40 bg-emerald-500/10",
      text: "text-emerald-300",
      badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
      bar: "bg-emerald-400",
    };
  }
  if (score >= 50) {
    return {
      card: "border-indigo-400/40 bg-indigo-500/10",
      text: "text-indigo-200",
      badge: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/30",
      bar: "bg-indigo-400",
    };
  }
  return {
    card: "border-amber-400/40 bg-amber-500/10",
    text: "text-amber-300",
    badge: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    bar: "bg-amber-400",
  };
}

export function checkedIdsFromItems(items: ChecklistItem[]): string[] {
  return items.filter((item) => item.checked).map((item) => item.id);
}
