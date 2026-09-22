import { getUserTimeZone } from "@/lib/time";

export type SessionId = "sydney" | "tokyo" | "london" | "newyork";

export type MarketSession = {
  id: SessionId;
  name: string;
  timeZone: string;
  openHour: number;
  closeHour: number;
};

export type SessionWindow = {
  id: SessionId;
  name: string;
  active: boolean;
  localRange: string;
};

export type MarketClock = {
  isOpen: boolean;
  isOverlap: boolean;
  label: string;
  activeSessions: MarketSession[];
  sessions: SessionWindow[];
  nextChangeKind: "open" | "close" | null;
  nextChangeLabel: string | null;
  userTimeZone: string;
  userTimeZoneShort: string;
  userTimeZoneLong: string;
};

export const MARKET_SESSIONS: MarketSession[] = [
  {
    id: "sydney",
    name: "Asia / Sydney",
    timeZone: "Australia/Sydney",
    openHour: 8,
    closeHour: 17,
  },
  {
    id: "tokyo",
    name: "Asia / Tokyo",
    timeZone: "Asia/Tokyo",
    openHour: 9,
    closeHour: 18,
  },
  {
    id: "london",
    name: "London",
    timeZone: "Europe/London",
    openHour: 8,
    closeHour: 17,
  },
  {
    id: "newyork",
    name: "New York",
    timeZone: "America/New_York",
    openHour: 8,
    closeHour: 17,
  },
];

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const NY_TIME_ZONE = "America/New_York";
const NY_WEEKEND_CLOSE_HOUR = 17;

type ZonedParts = {
  weekday: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = WEEKDAY_INDEX[readPart(parts, "weekday")] ?? 0;

  return {
    weekday,
    year: Number(readPart(parts, "year")),
    month: Number(readPart(parts, "month")),
    day: Number(readPart(parts, "day")),
    hour: Number(readPart(parts, "hour")),
    minute: Number(readPart(parts, "minute")),
    second: Number(readPart(parts, "second")),
  };
}

export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const actual = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = target - actual;
    if (delta === 0) break;
    guess += delta;
  }

  return new Date(guess);
}

function minutesFromMidnight(parts: Pick<ZonedParts, "hour" | "minute">): number {
  return parts.hour * 60 + parts.minute;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function detectUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || getUserTimeZone();
  } catch {
    return getUserTimeZone();
  }
}

export function formatTimeZoneShort(date: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  return name ?? timeZone;
}

export function formatTimeZoneLong(date: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "long",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  return name ?? timeZone.replace(/_/g, " ");
}

function formatClock(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeekdayTime(date: Date, timeZone: string): string {
  return date.toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  const left = getZonedParts(a, timeZone);
  const right = getZonedParts(b, timeZone);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function formatChangeTime(at: Date, now: Date, userTimeZone: string): string {
  return sameLocalDay(at, now, userTimeZone)
    ? formatClock(at, userTimeZone)
    : formatWeekdayTime(at, userTimeZone);
}

/**
 * Forex weekend: Friday 5:00 PM America/New_York through Sunday 5:00 PM.
 * Uses Eastern Time so the close tracks EST in winter and EDT in summer.
 */
export function isForexWeekendClosed(date: Date): boolean {
  const ny = getZonedParts(date, NY_TIME_ZONE);
  const minutes = minutesFromMidnight(ny);
  const closeMinutes = NY_WEEKEND_CLOSE_HOUR * 60;

  if (ny.weekday === 5) return minutes >= closeMinutes;
  if (ny.weekday === 6) return true;
  if (ny.weekday === 0) return minutes < closeMinutes;
  return false;
}

export function isSessionActive(date: Date, session: MarketSession): boolean {
  const local = getZonedParts(date, session.timeZone);
  const minutes = minutesFromMidnight(local);
  return (
    minutes >= session.openHour * 60 && minutes < session.closeHour * 60
  );
}

function sessionInstantOnCalendarDay(
  session: MarketSession,
  year: number,
  month: number,
  day: number,
  hour: number
): Date {
  return zonedTimeToUtc(session.timeZone, year, month, day, hour, 0, 0);
}

function localRangeForSession(
  date: Date,
  session: MarketSession,
  userTimeZone: string
): string {
  const local = getZonedParts(date, session.timeZone);
  const open = sessionInstantOnCalendarDay(
    session,
    local.year,
    local.month,
    local.day,
    session.openHour
  );
  const close = sessionInstantOnCalendarDay(
    session,
    local.year,
    local.month,
    local.day,
    session.closeHour
  );

  return `${formatClock(open, userTimeZone)} – ${formatClock(close, userTimeZone)}`;
}

function nextNyBoundary(date: Date, hour: number, fromWeekday: number): Date {
  const ny = getZonedParts(date, NY_TIME_ZONE);
  let delta = (fromWeekday - ny.weekday + 7) % 7;
  const candidate = addDays(ny.year, ny.month, ny.day, delta);
  let instant = zonedTimeToUtc(
    NY_TIME_ZONE,
    candidate.year,
    candidate.month,
    candidate.day,
    hour
  );

  if (instant.getTime() <= date.getTime()) {
    const next = addDays(candidate.year, candidate.month, candidate.day, 7);
    instant = zonedTimeToUtc(
      NY_TIME_ZONE,
      next.year,
      next.month,
      next.day,
      hour
    );
  }

  return instant;
}

function nextSessionBoundary(
  date: Date,
  session: MarketSession
): { at: Date; kind: "open" | "close" } {
  const local = getZonedParts(date, session.timeZone);
  const minutes = minutesFromMidnight(local);
  const openMinutes = session.openHour * 60;
  const closeMinutes = session.closeHour * 60;

  if (minutes < openMinutes) {
    return {
      at: sessionInstantOnCalendarDay(
        session,
        local.year,
        local.month,
        local.day,
        session.openHour
      ),
      kind: "open",
    };
  }

  if (minutes < closeMinutes) {
    return {
      at: sessionInstantOnCalendarDay(
        session,
        local.year,
        local.month,
        local.day,
        session.closeHour
      ),
      kind: "close",
    };
  }

  const tomorrow = addDays(local.year, local.month, local.day, 1);
  return {
    at: sessionInstantOnCalendarDay(
      session,
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      session.openHour
    ),
    kind: "open",
  };
}

function buildLabel(active: MarketSession[]): string {
  if (active.length === 0) return "Markets Open";
  return active.map((session) => session.name.replace(/^Asia \/ /, "")).join(" / ");
}

export function getMarketClock(
  date: Date = new Date(),
  userTimeZone = detectUserTimeZone()
): MarketClock {
  const weekendClosed = isForexWeekendClosed(date);
  const sessions = MARKET_SESSIONS.map((session) => ({
    id: session.id,
    name: session.name,
    active: !weekendClosed && isSessionActive(date, session),
    localRange: localRangeForSession(date, session, userTimeZone),
  }));

  const activeSessions = MARKET_SESSIONS.filter((_, index) => sessions[index].active);
  const isOverlap = activeSessions.length > 1;
  const zoneShort = formatTimeZoneShort(date, userTimeZone);
  const zoneLong = formatTimeZoneLong(date, userTimeZone);
  const hasSession = activeSessions.length > 0;

  if (weekendClosed || !hasSession) {
    const opens = weekendClosed
      ? nextNyBoundary(date, NY_WEEKEND_CLOSE_HOUR, 0)
      : MARKET_SESSIONS.map((session) => nextSessionBoundary(date, session))
          .filter((item) => item.kind === "open" && item.at.getTime() > date.getTime())
          .sort((a, b) => a.at.getTime() - b.at.getTime())[0]?.at;

    return {
      isOpen: false,
      isOverlap: false,
      label: "Market Closed",
      activeSessions: [],
      sessions,
      nextChangeKind: opens ? "open" : null,
      nextChangeLabel: opens
        ? `Opens ${formatChangeTime(opens, date, userTimeZone)}`
        : null,
      userTimeZone,
      userTimeZoneShort: zoneShort,
      userTimeZoneLong: zoneLong,
    };
  }

  const weekendClose = {
    at: nextNyBoundary(date, NY_WEEKEND_CLOSE_HOUR, 5),
    kind: "close" as const,
  };

  const upcoming = [
    ...activeSessions.map((session) => nextSessionBoundary(date, session)),
    weekendClose,
  ]
    .filter((item) => item.at.getTime() > date.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

  return {
    isOpen: true,
    isOverlap,
    label: isOverlap
      ? buildLabel(activeSessions)
      : (activeSessions[0]?.name.replace(/^Asia \/ /, "") ?? "Market Closed"),
    activeSessions,
    sessions,
    nextChangeKind: upcoming?.kind ?? null,
    nextChangeLabel: upcoming
      ? `${upcoming.kind === "close" ? "Closes" : "Opens"} ${formatChangeTime(upcoming.at, date, userTimeZone)}`
      : null,
    userTimeZone,
    userTimeZoneShort: zoneShort,
    userTimeZoneLong: zoneLong,
  };
}
