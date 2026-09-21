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

export function checkedIdsFromItems(items: ChecklistItem[]): string[] {
  return items.filter((item) => item.checked).map((item) => item.id);
}
