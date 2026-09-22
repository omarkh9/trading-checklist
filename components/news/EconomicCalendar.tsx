"use client";

import { useWorkspaceSettings } from "@/components/workspace/WorkspaceProvider";
import {
  enumerateDateKeys,
  eventDayKey,
  formatCalendarDay,
  formatEventClock,
  forexFactoryDayUrl,
  groupEventsByDay,
  isAllDayEvent,
  shiftDateKey,
  type EconomicEvent,
  type NewsImpact,
} from "@/lib/news/calendar";
import { resolveDisplayTimeZone } from "@/lib/settings/workspace";
import { LiveFeedBadge } from "@/components/dashboard/SidebarLiveStatus";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const IMPACT_FILL: Record<NewsImpact, string> = {
  High: "var(--ff-impact-high, #E53935)",
  Medium: "var(--ff-impact-medium, #FB8C00)",
  Low: "var(--ff-impact-low, #FDD835)",
  Holiday: "var(--ff-impact-holiday, #9E9E9E)",
};

const CURRENCY_TONE: Record<string, string> = {
  USD: "text-emerald-300",
  EUR: "text-indigo-300",
  GBP: "text-violet-300",
  JPY: "text-rose-300",
  AUD: "text-amber-300",
  CAD: "text-red-300",
  CHF: "text-orange-200",
  NZD: "text-teal-300",
  CNY: "text-orange-300",
};

function impactRank(impact: NewsImpact): number {
  if (impact === "High") return 3;
  if (impact === "Medium") return 2;
  if (impact === "Low") return 1;
  return 0;
}

function ImpactMark({ impact }: { impact: NewsImpact }) {
  if (impact === "Holiday") {
    return (
      <span className="inline-flex" title="Holiday">
        <svg
          viewBox="0 0 14 12"
          className="h-3.5 w-4"
          aria-hidden="true"
        >
          <path
            fill="#9E9E9E"
            d="M1.4 3.1h3.6l.9 1.4H12.6c.3 0 .5.2.5.5v5.4c0 .3-.2.5-.5.5H1.4c-.3 0-.5-.2-.5-.5V3.6c0-.3.2-.5.5-.5z"
          />
        </svg>
        <span className="sr-only">Holiday</span>
      </span>
    );
  }

  const active = impact === "High" ? 3 : impact === "Medium" ? 2 : 1;
  const fill = IMPACT_FILL[impact];

  return (
    <span className="inline-flex" title={`${impact} impact`}>
      <svg viewBox="0 0 14 12" className="h-3.5 w-3.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <rect
            key={index}
            x={1 + index * 4}
            y={8 - index * 3}
            width="3"
            height={3 + index * 3}
            rx="0.4"
            fill={index < active ? fill : "var(--ff-impact-idle, rgba(255,255,255,0.12))"}
          />
        ))}
      </svg>
      <span className="sr-only">{impact} impact</span>
    </span>
  );
}

function rowTone(event: EconomicEvent, nowMs: number) {
  if (event.impact === "Holiday") {
    return "text-zinc-400";
  }
  const start = new Date(event.date).getTime();
  if (start < nowMs - 30 * 60 * 1000) return "text-zinc-400";
  if (event.impact === "High") return "bg-rose-500/[0.06]";
  return "";
}

export function EconomicCalendar({ compact = false }: { compact?: boolean }) {
  const { settings } = useWorkspaceSettings();
  const timeZone = resolveDisplayTimeZone(settings.timeZone);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/news/calendar");
        const payload = (await response.json()) as {
          ok?: boolean;
          events?: EconomicEvent[];
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load the calendar.");
        }
        if (!cancelled) {
          setEvents(payload.events ?? []);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load the calendar."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    const poll = window.setInterval(() => void load(), 5 * 60 * 1000);
    const tick = window.setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, []);

  const todayKey = eventDayKey(new Date(nowMs).toISOString(), timeZone);

  const filtered = useMemo(() => {
    const minRank =
      settings.newsImpact === "high"
        ? 3
        : settings.newsImpact === "medium"
          ? 2
          : 0;
    return events.filter((event) => impactRank(event.impact) >= minRank);
  }, [events, settings.newsImpact]);

  const byDay = useMemo(
    () => groupEventsByDay(filtered, timeZone),
    [filtered, timeZone]
  );

  const dayKeys = useMemo(() => {
    const all = groupEventsByDay(events, timeZone);
    const keys = [...all.keys()].sort();
    if (keys.length === 0) {
      return enumerateDateKeys(
        shiftDateKey(todayKey, -1),
        shiftDateKey(todayKey, 5)
      );
    }
    return enumerateDateKeys(keys[0], keys[keys.length - 1]);
  }, [events, timeZone, todayKey]);

  const activeDay = useMemo(() => {
    if (selectedDay && dayKeys.includes(selectedDay)) return selectedDay;
    if (dayKeys.includes(todayKey)) return todayKey;
    const upcoming = dayKeys.find((key) => key >= todayKey);
    return upcoming ?? dayKeys[0] ?? todayKey;
  }, [dayKeys, selectedDay, todayKey]);

  const dayEvents = byDay.get(activeDay) ?? [];
  const dayIndex = dayKeys.indexOf(activeDay);
  const canPrev = dayIndex > 0;
  const canNext = dayIndex >= 0 && dayIndex < dayKeys.length - 1;

  const goDay = (delta: number) => {
    const next = shiftDateKey(activeDay, delta);
    if (dayKeys.includes(next)) setSelectedDay(next);
  };

  return (
    <section className="economic-calendar relative z-0 min-w-0 overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0c0c16]/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-0.5 bg-gradient-to-r from-amber-400 via-indigo-400 to-rose-400" />

      <div className="economic-calendar-header relative z-20 px-4 pb-3 pt-5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
              Economic Calendar
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Forex Factory · {timeZone.replace(/_/g, " ")}
            </p>
            <div className="mt-2">
              <LiveFeedBadge active={!error} />
            </div>
          </div>
          <a
            href={forexFactoryDayUrl(activeDay)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300 hover:text-indigo-200"
          >
            FF source
          </a>
        </div>

        <div className="date-selector relative z-20 mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => goDay(-1)}
            disabled={!canPrev}
            className="economic-calendar-nav relative z-[25] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {formatCalendarDay(activeDay, "long")}
              {activeDay === todayKey ? " · Today" : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() => goDay(1)}
            disabled={!canNext}
            className="economic-calendar-nav relative z-[25] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {dayKeys.length > 1 && (
          <div className="date-selector relative z-20 mt-3 flex gap-1 overflow-x-auto pb-1">
            {dayKeys.map((key) => {
              const selected = key === activeDay;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`date-pill economic-calendar-day relative z-[25] flex min-w-[2.75rem] flex-1 cursor-pointer flex-col items-center rounded-md px-1 py-1.5 text-center transition-colors ${
                    selected
                      ? "is-selected bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.28)]"
                      : isToday
                        ? "is-today border border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                        : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-wider">
                    {formatCalendarDay(key, "strip").slice(0, 3)}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums">
                    {Number(key.slice(-2))}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="mx-4 mb-5 h-52 animate-pulse rounded-xl bg-white/[0.03] sm:mx-5" />
      ) : error && events.length === 0 ? (
        <p className="mx-4 mb-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 sm:mx-5">
          {error}
        </p>
      ) : (
        <div
          className={`relative z-0 min-w-0 overflow-x-auto ${
            compact ? "max-h-[28rem]" : "max-h-[36rem]"
          } overflow-y-auto`}
        >
          <table className="w-full min-w-[36rem] border-t border-white/10 text-left text-[12px]">
            <thead className="economic-calendar-head sticky top-0 z-10 bg-[#12121a]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-2 py-2 font-semibold">Cur</th>
                <th className="px-2 py-2 font-semibold">Imp.</th>
                <th className="px-2 py-2 font-semibold">Event</th>
                <th className="px-2 py-2 text-right font-semibold">Actual</th>
                <th className="px-2 py-2 text-right font-semibold">Forecast</th>
                <th className="px-3 py-2 text-right font-semibold">Previous</th>
              </tr>
            </thead>
            <tbody>
              {dayEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    {filtered.length === 0 && events.length > 0
                      ? "No events match the current impact filter."
                      : "No Forex Factory events for this day."}
                  </td>
                </tr>
              ) : (
                dayEvents.map((event, index) => {
                  const allDay = isAllDayEvent(event);
                  const clock = allDay
                    ? "All Day"
                    : formatEventClock(event.date, timeZone);
                  const previousClock = (() => {
                    if (index === 0) return "";
                    const prev = dayEvents[index - 1];
                    if (isAllDayEvent(prev)) return "All Day";
                    return formatEventClock(prev.date, timeZone);
                  })();
                  const showTime = clock !== previousClock;
                  const high = event.impact === "High";

                  return (
                    <tr
                      key={event.id}
                      className={`border-t border-white/5 ${rowTone(event, nowMs)} ${
                        high ? "border-l-2 border-l-[#E53935]" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 align-middle font-medium tabular-nums text-zinc-300">
                        {showTime ? clock : ""}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2 align-middle font-semibold ${
                          CURRENCY_TONE[event.country] ?? "text-zinc-200"
                        }`}
                      >
                        {event.country}
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <ImpactMark impact={event.impact} />
                      </td>
                      <td className="min-w-[10rem] px-2 py-2 align-middle font-medium text-zinc-100">
                        {event.title}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums text-zinc-200">
                        {event.actual}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums text-zinc-400">
                        {event.forecast}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-middle tabular-nums text-zinc-500">
                        {event.previous}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
