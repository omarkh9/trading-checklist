/** Browser-local timezone helpers. Naive DB timestamps are treated as UTC. */

export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function parseTimestamp(value: string | number | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "number") return new Date(value);

  const trimmed = String(value ?? "").trim();
  if (!trimmed) return new Date(Number.NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }

  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso)) {
    return new Date(`${iso}Z`);
  }

  return new Date(trimmed);
}

export function timestampMs(value: string | number | Date): number {
  const ms = parseTimestamp(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function zonedDateKey(
  value: string | number | Date,
  timeZone = getUserTimeZone()
): string {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return `${readPart(parts, "year")}-${readPart(parts, "month")}-${readPart(parts, "day")}`;
}

export function localDateKey(date: Date = new Date()): string {
  return zonedDateKey(date);
}

export function dateKeyFromDate(date: Date): string {
  return zonedDateKey(date);
}

export function formatInTimeZone(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: getUserTimeZone(),
  }).format(date);
}

export function formatLocalDateTime(value: string | number | Date): string {
  return formatInTimeZone(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLocalDate(value: string | number | Date): string {
  return formatInTimeZone(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatLocalDateShort(value: string | number | Date): string {
  return formatInTimeZone(value, {
    month: "short",
    day: "numeric",
  });
}

export function formatLocalMonthYear(value: string | number | Date): string {
  return formatInTimeZone(value, {
    month: "long",
    year: "numeric",
  });
}

export function formatCalendarDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return formatInTimeZone(new Date(year, month - 1, day), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isoTimestampForDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return new Date().toISOString();
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

export function startOfLocalWeek(date: Date = new Date()): Date {
  const [year, month, day] = localDateKey(date).split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const weekday = start.getDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - diff);
  return start;
}

export function startOfLocalMonth(date: Date = new Date()): Date {
  const [year, month] = localDateKey(date).split("-").map(Number);
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export function endOfLocalMonth(date: Date = new Date()): Date {
  const [year, month] = localDateKey(date).split("-").map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function monthKeyFromDate(date: Date = new Date()): string {
  return localDateKey(date).slice(0, 7);
}
