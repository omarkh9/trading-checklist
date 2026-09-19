"use client";

import {
  deleteChecklistRule,
  fetchChecklistSnapshot,
  insertChecklistRule,
  insertChecklistRules,
  reorderChecklistRules,
  saveChecklistSession,
  updateChecklistRule,
} from "@/lib/supabase/checklist";
import {
  localDateKey,
  withDailyChecks,
  type ChecklistItem,
  type ChecklistSession,
} from "@/lib/types/checklist";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function usePersistedChecklist() {
  const sessionDate = useMemo(() => localDateKey(), []);
  const [rules, setRules] = useState<ChecklistItem[]>([]);
  const [session, setSession] = useState<ChecklistSession>({
    date: sessionDate,
    checkedRuleIds: [],
    confidence: 70,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const snapshot = await fetchChecklistSnapshot(sessionDate);
        if (cancelled) return;
        setRules(withDailyChecks(snapshot.rules, snapshot.session));
        setSession(snapshot.session);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setRules([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your checklist."
          );
        }
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionDate]);

  const persistSession = useCallback(async (next: ChecklistSession) => {
    setSession(next);
    try {
      await saveChecklistSession(next);
      setError(null);
    } catch (saveError) {
      setError(
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

      setRules((prev) =>
        prev.map((rule) =>
          rule.id === id ? { ...rule, checked: !rule.checked } : rule
        )
      );
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
    setRules((prev) => prev.map((rule) => ({ ...rule, checked: false })));
    await persistSession({
      ...sessionRef.current,
      checkedRuleIds: [],
    });
  }, [persistSession]);

  const addRule = useCallback(async (label: string) => {
    setIsSaving(true);
    try {
      const created = await insertChecklistRule(label);
      setRules((prev) => [...prev, { ...created, checked: false }]);
      setError(null);
    } catch (saveError) {
      setError(
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
      const created = await insertChecklistRules(labels);
      setRules((prev) => [
        ...prev,
        ...created.map((rule) => ({ ...rule, checked: false })),
      ]);
      setError(null);
    } catch (saveError) {
      setError(
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
    const previous = rules;
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, label } : rule))
    );
    try {
      await updateChecklistRule(id, label);
      setError(null);
    } catch (saveError) {
      setRules(previous);
      setError(
        saveError instanceof Error ? saveError.message : "Could not update rule."
      );
    }
  }, [rules]);

  const removeRule = useCallback(
    async (id: string) => {
      const previousRules = rules;
      const previousSession = sessionRef.current;
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      const nextSession = {
        ...previousSession,
        checkedRuleIds: previousSession.checkedRuleIds.filter(
          (ruleId) => ruleId !== id
        ),
      };
      setSession(nextSession);
      try {
        await deleteChecklistRule(id);
        await saveChecklistSession(nextSession);
        setError(null);
      } catch (saveError) {
        setRules(previousRules);
        setSession(previousSession);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not delete rule."
        );
      }
    },
    [rules]
  );

  const moveRule = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const fromIndex = rules.findIndex((rule) => rule.id === fromId);
      const toIndex = rules.findIndex((rule) => rule.id === toId);
      if (fromIndex < 0 || toIndex < 0) return;

      const next = [...rules];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const ordered = next.map((rule, index) => ({ ...rule, sortOrder: index }));
      setRules(ordered);

      try {
        await reorderChecklistRules(ordered.map((rule) => rule.id));
        setError(null);
      } catch (saveError) {
        setRules(rules);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not reorder rules."
        );
      }
    },
    [rules]
  );

  return {
    rules,
    session,
    sessionDate,
    isLoaded,
    isSaving,
    error,
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
