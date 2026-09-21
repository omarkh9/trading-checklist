export type NewsImpact = "High" | "Medium" | "Low" | "Holiday";

export type EconomicEvent = {
  id: string;
  title: string;
  country: string;
  impact: NewsImpact;
  date: string;
  forecast: string;
  previous: string;
  actual: string;
};

type RawEvent = {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
  actual?: unknown;
};

const FEED_URLS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json",
];

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function parseImpact(value: unknown): NewsImpact {
  const normalized = asText(value).toLowerCase();
  if (normalized.includes("high") || normalized === "red") return "High";
  if (normalized.includes("medium") || normalized === "orange") return "Medium";
  if (normalized.includes("holiday")) return "Holiday";
  return "Low";
}

function parseEventDate(value: unknown): string | null {
  const raw = asText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const match = raw.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})\s*(am|pm)?)?/i
  );
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const meridian = match[6]?.toLowerCase();
  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;

  const asEastern = new Date(
    Date.UTC(year, month - 1, day, hour + 4, minute)
  );
  return Number.isNaN(asEastern.getTime()) ? null : asEastern.toISOString();
}

export function normalizeEconomicEvents(payload: unknown): EconomicEvent[] {
  const rows = Array.isArray(payload) ? payload : [];
  const events: EconomicEvent[] = [];

  rows.forEach((row, index) => {
    const item = (row ?? {}) as RawEvent;
    const title = asText(item.title);
    const date = parseEventDate(item.date);
    if (!title || !date) return;

    events.push({
      id: `${date}-${asText(item.country)}-${title}-${index}`,
      title,
      country: asText(item.country).toUpperCase() || "USD",
      impact: parseImpact(item.impact),
      date,
      forecast: asText(item.forecast),
      previous: asText(item.previous),
      actual: asText(item.actual),
    });
  });

  return events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export async function fetchForexFactoryCalendar(): Promise<EconomicEvent[]> {
  let lastError: Error | null = null;

  for (const url of FEED_URLS) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      });
      if (!response.ok) {
        lastError = new Error(`Calendar feed failed (${response.status})`);
        continue;
      }
      const payload = await response.json();
      return normalizeEconomicEvents(payload);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Calendar feed failed");
    }
  }

  throw lastError ?? new Error("Calendar feed failed");
}

export function formatEventTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatEventClock(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function eventDayKey(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
