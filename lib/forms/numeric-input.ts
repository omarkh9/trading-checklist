export function sanitizeNumericDraft(
  value: string,
  options?: { allowNegative?: boolean }
): string {
  const allowNegative = options?.allowNegative ?? false;
  const stripped = value.replace(/,/g, "");
  let next = "";
  let sawDot = false;
  let sawDigit = false;

  for (const char of stripped) {
    if (char === "-" && allowNegative && next.length === 0) {
      next = "-";
      continue;
    }
    if (char === "." && !sawDot) {
      sawDot = true;
      next += ".";
      continue;
    }
    if (char >= "0" && char <= "9") {
      sawDigit = true;
      next += char;
    }
  }

  if (!sawDigit && !sawDot) {
    return next === "-" ? "-" : "";
  }

  const negative = next.startsWith("-");
  let body = negative ? next.slice(1) : next;
  body = body.replace(/^0+(?=\d)/, "");
  return `${negative ? "-" : ""}${body}`;
}

export function parseNumericDraft(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumericDraft(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

export function clampNumeric(
  value: number,
  min?: number,
  max?: number
): number {
  let next = value;
  if (min != null && next < min) next = min;
  if (max != null && next > max) next = max;
  return next;
}
