"use client";

import { ConfidenceMeter } from "@/components/pre-trade-checklist/ConfidenceMeter";
import { DeskCard } from "@/components/ui/DeskCard";
import {
  createDefaultRules,
  type ChecklistRule,
} from "@/lib/types/checklist";
import { desk } from "@/lib/ui/desk";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const RULES_STORAGE_KEY = "edge-log-checklist-rules";
const CONFIDENCE_STORAGE_KEY = "edge-log-checklist-confidence";

const inputClass = desk.input;

type StoredState = {
  rules: ChecklistRule[];
};

function loadState(): StoredState {
  if (typeof window === "undefined") {
    return { rules: createDefaultRules() };
  }
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return { rules: createDefaultRules() };
    const parsed = JSON.parse(raw) as StoredState;
    return parsed.rules?.length ? parsed : { rules: createDefaultRules() };
  } catch {
    return { rules: createDefaultRules() };
  }
}

function loadConfidence(): number {
  if (typeof window === "undefined") return 70;
  try {
    const raw = localStorage.getItem(CONFIDENCE_STORAGE_KEY);
    return raw ? Number(raw) : 70;
  } catch {
    return 70;
  }
}

export function PreTradeChecklist() {
  const [rules, setRules] = useState<ChecklistRule[]>([]);
  const [executionConfidence, setExecutionConfidence] = useState(70);
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setRules(loadState().rules);
    setExecutionConfidence(loadConfidence());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify({ rules }));
  }, [rules, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(CONFIDENCE_STORAGE_KEY, String(executionConfidence));
  }, [executionConfidence, isLoaded]);

  const checkedCount = rules.filter((r) => r.checked).length;
  const totalCount = rules.length;
  const checklistProgress =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allRulesMet = totalCount > 0 && checkedCount === totalCount;

  const toggleRule = (id: string) => {
    if (editingId) return;
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingLabel("");
    }
  };

  const addRule = () => {
    const label = newRuleLabel.trim();
    if (!label) return;

    setRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label, isDefault: false, checked: false },
    ]);
    setNewRuleLabel("");
  };

  const startEdit = (rule: ChecklistRule) => {
    setEditingId(rule.id);
    setEditingLabel(rule.label);
  };

  const saveEdit = () => {
    const label = editingLabel.trim();
    if (!label || !editingId) return;

    setRules((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, label } : r))
    );
    setEditingId(null);
    setEditingLabel("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingLabel("");
  };

  const resetChecklist = () => {
    setRules((prev) => prev.map((r) => ({ ...r, checked: false })));
  };

  const resetToDefaults = () => {
    setRules(createDefaultRules());
    setExecutionConfidence(70);
    setEditingId(null);
    setEditingLabel("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ConfidenceMeter
        checklistProgress={checklistProgress}
        executionConfidence={executionConfidence}
        onConfidenceChange={setExecutionConfidence}
        allRulesMet={allRulesMet}
      />

      <DeskCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center"
              aria-hidden
            >
              <svg className="-rotate-90" width="56" height="56" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="#1a1a2e"
                  strokeWidth="5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke={allRulesMet ? "#34d399" : "#818cf8"}
                  strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={
                    2 * Math.PI * 22 -
                    (checklistProgress / 100) * 2 * Math.PI * 22
                  }
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                  style={{
                    filter: allRulesMet
                      ? "drop-shadow(0 0 8px rgba(16,185,129,0.55))"
                      : "drop-shadow(0 0 8px rgba(99,102,241,0.35))",
                  }}
                />
              </svg>
              <span className="absolute text-[10px] font-semibold tabular-nums text-zinc-200">
                {checkedCount}/{totalCount || 0}
              </span>
            </div>
            <div>
              <h3 className={desk.title}>Trading Rules</h3>
              <p className={desk.subtitle}>
                Add, edit, or remove rules to match your trading edge.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetChecklist}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Checks
          </button>
        </div>

        <ul className="mt-6 space-y-2">
          {rules.map((rule) => {
            const isEditing = editingId === rule.id;

            return (
              <li key={rule.id}>
                <div
                  className={`group flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 ${
                    rule.checked && !isEditing
                      ? "bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.12)] ring-1 ring-emerald-400/35"
                      : "border border-white/5 bg-white/[0.03] hover:border-indigo-400/25 hover:bg-indigo-500/5"
                  }`}
                >
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className="shrink-0"
                      aria-label={`Toggle ${rule.label}`}
                    >
                      {rule.checked ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-600 transition-colors duration-300 group-hover:text-indigo-300" />
                      )}
                    </button>
                  )}

                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editingLabel.trim()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Save edit"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-zinc-500 transition-all duration-300 hover:bg-white/5 hover:text-zinc-300"
                        aria-label="Cancel edit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleRule(rule.id)}
                        className={`flex-1 text-left text-sm transition-colors ${
                          rule.checked
                            ? "text-zinc-400 line-through"
                            : "text-zinc-200"
                        }`}
                      >
                        {rule.label}
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(rule)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-all duration-300 hover:bg-indigo-500/15 hover:text-indigo-200"
                          aria-label={`Edit ${rule.label}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-400"
                          aria-label={`Delete ${rule.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {rules.length === 0 && (
          <p className="mt-4 text-center text-sm text-zinc-500">
            No rules yet. Add your first custom rule below.
          </p>
        )}

        <div className={`${desk.panel} mt-4`}>
          <label htmlFor="new-rule" className={desk.label}>
            Add Custom Rule
          </label>
          <div className="flex gap-2">
            <input
              id="new-rule"
              type="text"
              placeholder="e.g. Volume above average on entry"
              value={newRuleLabel}
              onChange={(e) => setNewRuleLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addRule();
              }}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={addRule}
              disabled={!newRuleLabel.trim()}
              className={`${desk.btnPrimary} shrink-0 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Add
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            <span className="font-medium text-zinc-300">{checkedCount}</span> of{" "}
            <span className="font-medium text-zinc-300">{totalCount}</span>{" "}
            rules confirmed
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={resetToDefaults}
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Restore default rules
            </button>

            {allRulesMet ? (
              <Link
                href="/trade-journal"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.28)] transition-all duration-300 hover:from-emerald-400 hover:to-teal-400"
              >
                Proceed to Trade Logging
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-600"
              >
                Proceed to Trade Logging
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </DeskCard>
    </div>
  );
}
