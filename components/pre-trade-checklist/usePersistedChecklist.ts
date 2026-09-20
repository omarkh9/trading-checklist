"use client";

import { useCachedChecklist } from "@/components/pre-trade-checklist/useCachedChecklist";
import {
  deleteChecklistRule,
  insertChecklistRule,
  insertChecklistRules,
  reorderChecklistRules,
  saveChecklistSession,
  updateChecklistRule,
} from "@/lib/supabase/checklist";
import { patchChecklistCache } from "@/lib/checklist/checklist-cache";
import {
  localDateKey,
  withDailyChecks,
  type ChecklistSession,
} from "@/lib/types/checklist";
import { useCallback, useMemo, useRef, useState } from "react";

export function usePersistedChecklist() {
  const {
    rules: cachedRules,
    session,
    isLoaded,
    error: loadError,
  } = useCachedChecklist();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sessionRef = useRef(session);
  const rulesRef = useRef(cachedRules);
  sessionRef.current = session;
  rulesRef.current = cachedRules;

  const rules = useMemo(
    () => withDailyChecks(cachedRules, session),
    [cachedRules, session]
  );

  const persistSession = useCallback(async (next: ChecklistSession) => {
    patchChecklistCache({ session: next });
    try {
      await saveChecklistSession(next);
      setMutationError(null);
    } catch (saveError) {
      setMutationError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save today's session."
      );
    }
  }, []);

  const toggleRule = useCallback(
    async (id: string) => {
      const checked = new Set(sessionRef.current.checkedRuleIds);
      if (checked.has(id)) checked.delete(id);
      else checked.add(id);
      await persistSession({
        ...sessionRef.current,
        checkedRuleIds: Array.from(checked),
      });
    },
    [persistSession]
  );

  const setConfidence = useCallback(
    (confidence: number) => {
      void persistSession({ ...sessionRef.current, confidence });
    },
    [persistSession]
  );

  const resetChecks = useCallback(async () => {
    await persistSession({
      ...sessionRef.current,
      checkedRuleIds: [],
    });
  }, [persistSession]);

  const addRule = useCallback(async (label: string) => {
    setIsSaving(true);
    try {
      await insertChecklistRule(label);
      setMutationError(null);
    } catch (saveError) {
      setMutationError(
        saveError instanceof Error ? saveError.message : "Could not add rule."
      );
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const addSuggestedRules = useCallback(async (labels: string[]) => {
    setIsSaving(true);
    try {
      await insertChecklistRules(labels);
      setMutationError(null);
    } catch (saveError) {
      setMutationError(
        saveError instanceof Error
          ? saveError.message
          : "Could not add suggested rules."
      );
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const renameRule = useCallback(async (id: string, label: string) => {
    const previous = rulesRef.current;
    patchChecklistCache({
      rules: previous.map((rule) => (rule.id === id ? { ...rule, label } : rule)),
    });
    try {
      await updateChecklistRule(id, label);
      setMutationError(null);
    } catch (saveError) {
      patchChecklistCache({ rules: previous });
      setMutationError(
        saveError instanceof Error ? saveError.message : "Could not update rule."
      );
    }
  }, []);

  const removeRule = useCallback(async (id: string) => {
    const previousRules = rulesRef.current;
    const previousSession = sessionRef.current;
    try {
      await deleteChecklistRule(id);
      const nextSession = {
        ...sessionRef.current,
        checkedRuleIds: sessionRef.current.checkedRuleIds.filter(
          (ruleId) => ruleId !== id
        ),
      };
      await saveChecklistSession(nextSession);
      setMutationError(null);
    } catch (saveError) {
      patchChecklistCache({
        rules: previousRules,
        session: previousSession,
      });
      setMutationError(
        saveError instanceof Error
          ? saveError.message
          : "Could not delete rule."
      );
    }
  }, []);

  const moveRule = useCallback(async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const current = rulesRef.current;
    const fromIndex = current.findIndex((rule) => rule.id === fromId);
    const toIndex = current.findIndex((rule) => rule.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const ordered = next.map((rule, index) => ({ ...rule, sortOrder: index }));
    patchChecklistCache({ rules: ordered });

    try {
      await reorderChecklistRules(ordered.map((rule) => rule.id));
      setMutationError(null);
    } catch (saveError) {
      patchChecklistCache({ rules: current });
      setMutationError(
        saveError instanceof Error
          ? saveError.message
          : "Could not reorder rules."
      );
    }
  }, []);

  return {
    rules,
    session,
    sessionDate: session.date || localDateKey(),
    isLoaded,
    isSaving,
    error: mutationError ?? loadError,
    toggleRule,
    setConfidence,
    resetChecks,
    addRule,
    addSuggestedRules,
    renameRule,
    removeRule,
    moveRule,
  };
}
