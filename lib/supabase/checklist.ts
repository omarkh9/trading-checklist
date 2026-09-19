import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { CHECKLIST_RULES_STORAGE_KEY } from "@/lib/storage/keys";
import {
  emptyChecklistSession,
  localDateKey,
  SUGGESTED_RULES,
  type ChecklistRule,
  type ChecklistSession,
  type ChecklistSnapshot,
} from "@/lib/types/checklist";

type ChecklistRuleRow = Database["public"]["Tables"]["checklist_rules"]["Row"];
type ChecklistSessionRow =
  Database["public"]["Tables"]["checklist_sessions"]["Row"];

type LegacyStoredRule = {
  id?: string;
  label?: string;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function requireUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  throwIfError(error);
  if (!user) throw new Error("You must be signed in to manage your checklist.");
  return { supabase, userId: user.id };
}

function ruleFromRow(row: ChecklistRuleRow): ChecklistRule {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
  };
}

function sessionFromRow(row: ChecklistSessionRow): ChecklistSession {
  return {
    date: row.session_date,
    checkedRuleIds: row.checked_rule_ids ?? [],
    confidence: row.confidence,
  };
}

function readLegacyRules(): ChecklistRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHECKLIST_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { rules?: LegacyStoredRule[] };
    return (parsed.rules ?? [])
      .map((rule, index) => ({
        id: rule.id || crypto.randomUUID(),
        label: (rule.label ?? "").trim(),
        sortOrder: index,
      }))
      .filter((rule) => rule.label.length > 0);
  } catch {
    return [];
  }
}

function isStockDefaultSet(rules: ChecklistRule[]) {
  if (rules.length !== SUGGESTED_RULES.length) return false;
  return rules.every((rule, index) => rule.label === SUGGESTED_RULES[index]);
}

function clearLegacyRules() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHECKLIST_RULES_STORAGE_KEY);
  localStorage.removeItem("edge-log-checklist-confidence");
}

export async function fetchChecklistRules(): Promise<ChecklistRule[]> {
  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("checklist_rules")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(ruleFromRow);
}

export async function fetchChecklistSession(
  date = localDateKey()
): Promise<ChecklistSession> {
  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase
    .from("checklist_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("session_date", date)
    .maybeSingle();
  throwIfError(error);
  return data ? sessionFromRow(data) : emptyChecklistSession(date);
}

async function migrateLegacyRulesIfNeeded(
  existing: ChecklistRule[]
): Promise<ChecklistRule[]> {
  if (existing.length > 0) return existing;
  const legacy = readLegacyRules();
  if (legacy.length === 0) return existing;

  // Previous builds auto-seeded stock defaults into localStorage.
  // Don't treat those as a configured routine.
  if (isStockDefaultSet(legacy)) {
    clearLegacyRules();
    return existing;
  }

  const inserted = await insertChecklistRules(
    legacy.map((rule) => rule.label)
  );
  clearLegacyRules();
  return inserted;
}

export async function fetchChecklistSnapshot(
  date = localDateKey()
): Promise<ChecklistSnapshot> {
  const [rules, session] = await Promise.all([
    fetchChecklistRules(),
    fetchChecklistSession(date),
  ]);
  const migrated = await migrateLegacyRulesIfNeeded(rules);
  return { rules: migrated, session };
}

export async function insertChecklistRule(label: string): Promise<ChecklistRule> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Enter a rule before adding it.");

  const { supabase, userId } = await requireUserId();
  const current = await fetchChecklistRules();
  const { data, error } = await supabase
    .from("checklist_rules")
    .insert({
      user_id: userId,
      label: trimmed,
      sort_order: current.length,
    })
    .select("*")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Could not save the new rule.");
  return ruleFromRow(data);
}

export async function insertChecklistRules(
  labels: string[]
): Promise<ChecklistRule[]> {
  const trimmed = labels.map((label) => label.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];

  const { supabase, userId } = await requireUserId();
  const current = await fetchChecklistRules();
  const { data, error } = await supabase
    .from("checklist_rules")
    .insert(
      trimmed.map((label, index) => ({
        user_id: userId,
        label,
        sort_order: current.length + index,
      }))
    )
    .select("*")
    .order("sort_order", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(ruleFromRow);
}

export async function updateChecklistRule(
  id: string,
  label: string
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Rule text cannot be empty.");

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("checklist_rules")
    .update({ label: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function deleteChecklistRule(id: string): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("checklist_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function reorderChecklistRules(orderedIds: string[]): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const results = await Promise.all(
    orderedIds.map((id, sortOrder) =>
      supabase
        .from("checklist_rules")
        .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
    )
  );
  results.forEach((result) => throwIfError(result.error));
}

export async function saveChecklistSession(
  session: ChecklistSession
): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("checklist_sessions").upsert(
    {
      user_id: userId,
      session_date: session.date,
      checked_rule_ids: session.checkedRuleIds,
      confidence: session.confidence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_date" }
  );
  throwIfError(error);
}
