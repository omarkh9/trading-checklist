export type ChecklistRule = {
  id: string;
  label: string;
  sortOrder: number;
};

export type ChecklistSession = {
  date: string;
  checkedRuleIds: string[];
  confidence: number;
};

export type ChecklistSnapshot = {
  rules: ChecklistRule[];
  session: ChecklistSession;
};

export type ChecklistItem = ChecklistRule & {
  checked: boolean;
};

export const SUGGESTED_RULES = [
  "Trend Alignment",
  "Key Level Identified",
  "Risk-to-Reward >= 1:2",
  "No Major High-Impact News in Next 30 Mins",
] as const;

export function emptyChecklistSession(date: string): ChecklistSession {
  return {
    date,
    checkedRuleIds: [],
    confidence: 70,
  };
}

export function withDailyChecks(
  rules: ChecklistRule[],
  session: ChecklistSession
): ChecklistItem[] {
  const checked = new Set(session.checkedRuleIds);
  return rules.map((rule) => ({
    ...rule,
    checked: checked.has(rule.id),
  }));
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
