const MONEY_NOISE = /[$€£%\s\u00a0]/g;

function finiteNumber(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function sanitizeNumericDraft(
  value: string,
  options?: { allowNegative?: boolean }
): string {
  const allowNegative = options?.allowNegative ?? false;
  const stripped = value.replace(/,/g, "").replace(/%/g, "");
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

  return next;
}

export function sanitizeMoneyDraft(
  value: string,
  options?: { allowNegative?: boolean }
): string {
  const allowNegative = options?.allowNegative ?? false;
  let next = "";

  for (const char of value.replace(MONEY_NOISE, "")) {
    if (char === "-" && allowNegative && next.length === 0) {
      next = "-";
      continue;
    }
    if (char === "." || char === ",") {
      next += char;
      continue;
    }
    if (char >= "0" && char <= "9") {
      next += char;
    }
  }

  return next;
}

function normalizeGroupedMoney(body: string): string | null {
  if (!body) return null;

  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastDot > lastComma) {
      return body.replace(/,/g, "");
    }
    return body.replace(/\./g, "").replace(",", ".");
  }

  if (lastComma !== -1) {
    const parts = body.split(",");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length > 1 && parts.every((part) => /^\d+$/.test(part))) {
      if (last.length === 3) return parts.join("");
      if (last.length <= 2) return `${parts.slice(0, -1).join("")}.${last}`;
    }
    return body.replace(/,/g, "");
  }

  if (lastDot !== -1) {
    const parts = body.split(".");
    const last = parts[parts.length - 1] ?? "";
    const groups = parts.slice(1);
    if (
      parts.length > 2 &&
      parts.every((part) => /^\d+$/.test(part)) &&
      groups.every((part) => part.length === 3)
    ) {
      return parts.join("");
    }
    if (
      parts.length === 2 &&
      /^\d+$/.test(parts[0] ?? "") &&
      /^\d+$/.test(last) &&
      last.length === 3 &&
      parts[0] !== "" &&
      parts[0] !== "0"
    ) {
      return parts.join("");
    }
    return body;
  }

  return body;
}

export function parseNumericDraft(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const parsed = Number(trimmed.replace(/,/g, "").replace(/%/g, ""));
  return finiteNumber(parsed);
}

export function parseMoneyDraft(value: string): number | null {
  const trimmed = value.trim().replace(MONEY_NOISE, "");
  if (
    !trimmed ||
    trimmed === "-" ||
    trimmed === "." ||
    trimmed === "," ||
    trimmed === "-." ||
    trimmed === "-,"
  ) {
    return null;
  }

  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  const normalized = normalizeGroupedMoney(body);
  if (normalized == null) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

export function asMoneyNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return parseMoneyDraft(value);
  return null;
}

export function formatNumericDraft(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

export function formatMoneyDraft(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2);
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
