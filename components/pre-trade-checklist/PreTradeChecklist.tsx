"use client";

import { ConfidenceMeter } from "@/components/pre-trade-checklist/ConfidenceMeter";
import { usePersistedChecklist } from "@/components/pre-trade-checklist/usePersistedChecklist";
import { DeskCard } from "@/components/ui/DeskCard";
import { formatCalendarDateLabel } from "@/lib/time";
import { SUGGESTED_RULES, type ChecklistItem } from "@/lib/types/checklist";
import { desk } from "@/lib/ui/desk";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  GripVertical,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useMemo, useState } from "react";

const inputClass = desk.input;

function sessionHeading(dateKey: string) {
  return formatCalendarDateLabel(dateKey);
}

function RuleComposer({
  id,
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  autoFocus = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        id={id}
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        maxLength={160}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        className={`${inputClass} flex-1`}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className={`${desk.btnPrimary} shrink-0 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Plus className="h-4 w-4" />
        Add rule
      </button>
    </div>
  );
}

const EmptyState = memo(function EmptyState({
  newRuleLabel,
  setNewRuleLabel,
  onAdd,
  onAddSuggested,
  isSaving,
}: {
  newRuleLabel: string;
  setNewRuleLabel: (value: string) => void;
  onAdd: () => void;
  onAddSuggested: () => void;
  isSaving: boolean;
}) {
  return (
    <DeskCard>
      <div className="flex flex-col items-center px-2 py-6 text-center sm:px-8 sm:py-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-400/30 shadow-[0_0_24px_rgba(99,102,241,0.2)]">
          <ListChecks className="h-8 w-8 text-indigo-300" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50">
          Configure your pre-trade routine
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
          Add your personal trading rules. They save to your account and become
          today&apos;s session checklist once you start.
        </p>

        <div className="mt-8 w-full max-w-xl text-left">
          <label htmlFor="first-rule" className={desk.label}>
            First rule
          </label>
          <RuleComposer
            id="first-rule"
            value={newRuleLabel}
            onChange={setNewRuleLabel}
            onSubmit={onAdd}
            disabled={isSaving}
            placeholder="e.g. Only trade with the higher-timeframe trend"
            autoFocus
          />
        </div>

        <button
          type="button"
          onClick={onAddSuggested}
          disabled={isSaving}
          className={`${desk.btnGhost} mt-6 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Start with suggested rules
        </button>
      </div>
    </DeskCard>
  );
});

const RuleRow = memo(function RuleRow({
  rule,
  isEditing,
  editingLabel,
  prevId,
  nextId,
  onEditingLabelChange,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onMove,
}: {
  rule: ChecklistItem;
  isEditing: boolean;
  editingLabel: string;
  prevId?: string;
  nextId?: string;
  onEditingLabelChange: (value: string) => void;
  onToggle: (id: string) => void;
  onStartEdit: (rule: ChecklistItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onMove: (fromId: string, toId: string) => void;
}) {
  return (
    <li>
      <div
        draggable={!isEditing}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", rule.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const fromId = event.dataTransfer.getData("text/plain");
          if (fromId) onMove(fromId, rule.id);
        }}
        className={`group flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-300 sm:px-4 ${
          rule.checked && !isEditing
            ? "bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.12)] ring-1 ring-emerald-400/35"
            : "border border-white/5 bg-white/[0.03] hover:border-indigo-400/25 hover:bg-indigo-500/5"
        }`}
      >
        {!isEditing && (
          <span
            className="hidden cursor-grab text-zinc-600 active:cursor-grabbing sm:inline-flex"
            aria-hidden
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}

        {!isEditing && (
          <button
            type="button"
            onClick={() => onToggle(rule.id)}
            className="shrink-0"
            aria-label={`${rule.checked ? "Uncheck" : "Check"} ${rule.label}`}
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
              maxLength={160}
              onChange={(e) => onEditingLabelChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editingLabel.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Save edit"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
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
              onClick={() => onToggle(rule.id)}
              className={`flex-1 text-left text-sm transition-colors ${
                rule.checked ? "text-zinc-400 line-through" : "text-zinc-200"
              }`}
            >
              {rule.label}
            </button>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => prevId && onMove(rule.id, prevId)}
                disabled={!prevId}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-all duration-300 hover:bg-indigo-500/15 hover:text-indigo-200 disabled:opacity-30"
                aria-label={`Move ${rule.label} up`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => nextId && onMove(rule.id, nextId)}
                disabled={!nextId}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-all duration-300 hover:bg-indigo-500/15 hover:text-indigo-200 disabled:opacity-30"
                aria-label={`Move ${rule.label} down`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onStartEdit(rule)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-all duration-300 hover:bg-indigo-500/15 hover:text-indigo-200"
                aria-label={`Edit ${rule.label}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(rule.id)}
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
});

export const PreTradeChecklist = memo(function PreTradeChecklist() {
  const {
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
  } = usePersistedChecklist();

  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const { checkedCount, totalCount, checklistProgress, allRulesMet } = useMemo(() => {
    const checked = rules.reduce(
      (count, rule) => count + (rule.checked ? 1 : 0),
      0
    );
    const total = rules.length;
    return {
      checkedCount: checked,
      totalCount: total,
      checklistProgress: total > 0 ? Math.round((checked / total) * 100) : 0,
      allRulesMet: total > 0 && checked === total,
    };
  }, [rules]);

  const sessionLabel = useMemo(
    () => sessionHeading(sessionDate),
    [sessionDate]
  );

  const submitNewRule = useCallback(async () => {
    const label = newRuleLabel.trim();
    if (!label) return;
    try {
      await addRule(label);
      setNewRuleLabel("");
    } catch {
      // Error banner is set by the hook.
    }
  }, [addRule, newRuleLabel]);

  const startEdit = useCallback((rule: ChecklistItem) => {
    setEditingId(rule.id);
    setEditingLabel(rule.label);
  }, []);

  const saveEdit = useCallback(async () => {
    const label = editingLabel.trim();
    if (!label || !editingId) return;
    await renameRule(editingId, label);
    setEditingId(null);
    setEditingLabel("");
  }, [editingId, editingLabel, renameRule]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingLabel("");
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      if (editingId) return;
      void toggleRule(id);
    },
    [editingId, toggleRule]
  );

  const handleDelete = useCallback(
    (id: string) => {
      void removeRule(id);
    },
    [removeRule]
  );

  const handleMove = useCallback(
    (fromId: string, toId: string) => {
      void moveRule(fromId, toId);
    },
    [moveRule]
  );

  const handleAddSuggested = useCallback(() => {
    void addSuggestedRules([...SUGGESTED_RULES]);
  }, [addSuggestedRules]);

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse space-y-6">
        <div className="h-56 rounded-2xl bg-[#0c0c16]/80" />
        <div className="h-80 rounded-2xl bg-[#0c0c16]/80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {rules.length === 0 ? (
        <EmptyState
          newRuleLabel={newRuleLabel}
          setNewRuleLabel={setNewRuleLabel}
          onAdd={submitNewRule}
          onAddSuggested={handleAddSuggested}
          isSaving={isSaving}
        />
      ) : (
        <>
          <ConfidenceMeter
            checklistProgress={checklistProgress}
            executionConfidence={session.confidence}
            onConfidenceChange={setConfidence}
            allRulesMet={allRulesMet}
            sessionLabel={sessionLabel}
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
                    {checkedCount}/{totalCount}
                  </span>
                </div>
                <div>
                  <h3 className={desk.title}>Today&apos;s session</h3>
                  <p className={desk.subtitle}>
                    Check off your rules for {sessionLabel}. Drag
                    or use arrows to reorder.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetChecks}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset today
              </button>
            </div>

            <ul className="mt-6 space-y-2">
              {rules.map((rule, index) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  prevId={rules[index - 1]?.id}
                  nextId={rules[index + 1]?.id}
                  isEditing={editingId === rule.id}
                  editingLabel={editingId === rule.id ? editingLabel : ""}
                  onEditingLabelChange={setEditingLabel}
                  onToggle={handleToggle}
                  onStartEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={handleDelete}
                  onMove={handleMove}
                />
              ))}
            </ul>

            <div className={`${desk.panel} mt-4`}>
              <label htmlFor="new-rule" className={desk.label}>
                Add another rule
              </label>
              <RuleComposer
                id="new-rule"
                value={newRuleLabel}
                onChange={setNewRuleLabel}
                onSubmit={submitNewRule}
                disabled={isSaving}
                placeholder="e.g. Volume above average on entry"
              />
            </div>

            <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                <span className="font-medium text-zinc-300">{checkedCount}</span>{" "}
                of <span className="font-medium text-zinc-300">{totalCount}</span>{" "}
                rules confirmed · {checklistProgress}% ready
              </p>

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
          </DeskCard>
        </>
      )}
    </div>
  );
});
