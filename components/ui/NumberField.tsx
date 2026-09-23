"use client";

import {
  clampNumeric,
  formatNumericDraft,
  parseNumericDraft,
  sanitizeNumericDraft,
} from "@/lib/forms/numeric-input";
import {
  useEffect,
  useState,
  type InputHTMLAttributes,
} from "react";

type SharedNumericProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
>;

type NumberFieldProps = SharedNumericProps & {
  value: number;
  onCommit: (value: number) => void;
  emptyValue?: number;
  allowNegative?: boolean;
};

export function NumberField({
  value,
  onCommit,
  emptyValue = 0,
  allowNegative = false,
  min,
  max,
  className,
  onFocus,
  onBlur,
  ...props
}: NumberFieldProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatNumericDraft(value));
  const minValue = typeof min === "number" ? min : undefined;
  const maxValue = typeof max === "number" ? max : undefined;

  useEffect(() => {
    if (!focused) setDraft(formatNumericDraft(value));
  }, [focused, value]);

  const commit = (raw: string) => {
    const parsed = parseNumericDraft(raw);
    const next = clampNumeric(parsed ?? emptyValue, minValue, maxValue);
    onCommit(next);
    return next;
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      min={min}
      max={max}
      className={className}
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = sanitizeNumericDraft(event.target.value, { allowNegative });
        setDraft(next);
        const parsed = parseNumericDraft(next);
        if (parsed != null) {
          onCommit(clampNumeric(parsed, minValue, maxValue));
        }
      }}
      onBlur={(event) => {
        const next = commit(draft);
        setDraft(formatNumericDraft(next));
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}

type NumericDraftInputProps = SharedNumericProps & {
  value: string;
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
};

export function NumericDraftInput({
  value,
  onValueChange,
  allowNegative = false,
  className,
  ...props
}: NumericDraftInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      className={className}
      value={value}
      onChange={(event) =>
        onValueChange(
          sanitizeNumericDraft(event.target.value, { allowNegative })
        )
      }
    />
  );
}
