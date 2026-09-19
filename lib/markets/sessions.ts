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
  nextChangeLabel: string | null;
  userTimeZone: string;
  userTimeZoneShort: string;
};

export const MARKET_SESSIONS: MarketSession[] = [
  {
    id: "sydney",
    name: "Asia / Sydney",
    timeZone: "Australia/Sydney",
    openHour: 9,
    closeHour: 18,
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

export function detectUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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

function formatClock(date: Date, timeZone: string): string {
  return date.toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeekdayTime(date: Date, timeZone: string): string {
  return date.toLocaleString(undefined, {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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

function nextSessionChange(
  date: Date,
  session: MarketSession
): Date {
  const local = getZonedParts(date, session.timeZone);
  const minutes = minutesFromMidnight(local);
  const openMinutes = session.openHour * 60;
  const closeMinutes = session.closeHour * 60;

  if (minutes < openMinutes) {
    return sessionInstantOnCalendarDay(
      session,
      local.year,
      local.month,
      local.day,
      session.openHour
    );
  }

  if (minutes < closeMinutes) {
    return sessionInstantOnCalendarDay(
      session,
      local.year,
      local.month,
      local.day,
      session.closeHour
    );
  }

  const tomorrow = addDays(local.year, local.month, local.day, 1);
  return sessionInstantOnCalendarDay(
    session,
    tomorrow.year,
    tomorrow.month,
    tomorrow.day,
    session.openHour
  );
}

function buildLabel(active: MarketSession[]): string {
  if (active.length === 0) return "Markets Open";
  return active.map((session) => session.name.replace(/^Asia \/ /, "")).join(" / ");
}

export function getMarketClock(
  date: Date = new Date(),
  userTimeZone = detectUserTimeZone()
): MarketClock {
  const closed = isForexWeekendClosed(date);
  const sessions = MARKET_SESSIONS.map((session) => ({
    id: session.id,
    name: session.name,
    active: !closed && isSessionActive(date, session),
    localRange: localRangeForSession(date, session, userTimeZone),
  }));

  const activeSessions = MARKET_SESSIONS.filter((_, index) => sessions[index].active);
  const isOverlap = activeSessions.length > 1;

  if (closed) {
    const opens = nextNyBoundary(date, NY_WEEKEND_CLOSE_HOUR, 0);
    return {
      isOpen: false,
      isOverlap: false,
      label: "Market Closed",
      activeSessions: [],
      sessions,
      nextChangeLabel: `Opens ${formatWeekdayTime(opens, userTimeZone)}`,
      userTimeZone,
      userTimeZoneShort: formatTimeZoneShort(date, userTimeZone),
    };
  }

  const upcoming = [
    nextNyBoundary(date, NY_WEEKEND_CLOSE_HOUR, 5),
    ...MARKET_SESSIONS.map((session) => nextSessionChange(date, session)),
  ]
    .filter((instant) => instant.getTime() > date.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    isOpen: true,
    isOverlap,
    label: isOverlap
      ? buildLabel(activeSessions)
      : (activeSessions[0]?.name ?? "Markets Open"),
    activeSessions,
    sessions,
    nextChangeLabel: upcoming
      ? `Next change ${formatWeekdayTime(upcoming, userTimeZone)}`
      : null,
    userTimeZone,
    userTimeZoneShort: formatTimeZoneShort(date, userTimeZone),
  };
}
