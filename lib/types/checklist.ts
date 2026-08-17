export type ChecklistRule = {
  id: string;
  label: string;
  isDefault: boolean;
  checked: boolean;
};

export const DEFAULT_RULES: Omit<ChecklistRule, "id" | "checked">[] = [
  { label: "Trend Alignment", isDefault: true },
  { label: "Key Level Identified", isDefault: true },
  { label: "Risk-to-Reward >= 1:2", isDefault: true },
  { label: "No Major High-Impact News in Next 30 Mins", isDefault: true },
];

export function createDefaultRules(): ChecklistRule[] {
  return DEFAULT_RULES.map((rule) => ({
    ...rule,
    id: crypto.randomUUID(),
    checked: false,
  }));
}
