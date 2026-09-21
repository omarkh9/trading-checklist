"use client";

import { useWorkspaceSettings } from "@/components/workspace/WorkspaceProvider";
import {
  eventDayKey,
  formatEventClock,
  formatEventTime,
  type EconomicEvent,
  type NewsImpact,
} from "@/lib/news/calendar";
import { resolveDisplayTimeZone } from "@/lib/settings/workspace";
import { localDateKey } from "@/lib/time";
import { desk } from "@/lib/ui/desk";
import { useEffect, useMemo, useState } from "react";

const impactClass: Record<NewsImpact, string> = {
  High: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  Medium: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  Low: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  Holiday: "bg-zinc-500/15 text-zinc-400 ring-zinc-400/25",
};

function impactRank(impact: NewsImpact): number {
  if (impact === "High") return 3;
  if (impact === "Medium") return 2;
  if (impact === "Low") return 1;
  return 0;
}

export function EconomicCalendar({ compact = false }: { compact?: boolean }) {
  const { settings } = useWorkspaceSettings();
  const timeZone = resolveDisplayTimeZone(settings.timeZone);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    const id = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const minRank =
      settings.newsImpact === "high"
        ? 3
        : settings.newsImpact === "medium"
          ? 2
          : 0;
    const now = Date.now() - 30 * 60 * 1000;
    return events
      .filter((event) => impactRank(event.impact) >= minRank)
      .filter((event) => new Date(event.date).getTime() >= now);
  }, [events, settings.newsImpact]);

  const grouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const event of filtered) {
      const key = eventDayKey(event.date, timeZone);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return [...map.entries()].slice(0, compact ? 2 : 7);
  }, [compact, filtered, timeZone]);

  const today = localDateKey(new Date());

  return (
    <section className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0c0c16]/90 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 via-indigo-400 to-rose-400" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
              Economic Calendar
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Live Forex Factory week · times in {timeZone.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 h-44 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : error ? (
          <p className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        ) : grouped.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            No upcoming events for the current filter.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {grouped.map(([day, dayEvents]) => (
              <div key={day}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {day === today
                    ? "Today"
                    : formatEventTime(dayEvents[0].date, timeZone).replace(
                        /, \d{1,2}:\d{2}.*/,
                        ""
                      )}
                </p>
                <ul className="mt-2 space-y-2">
                  {(compact ? dayEvents.slice(0, 6) : dayEvents).map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                            {event.country}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${impactClass[event.impact]}`}
                          >
                            {event.impact}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {event.forecast ? `Fcst ${event.forecast}` : "No forecast"}
                          {event.previous ? ` · Prev ${event.previous}` : ""}
                        </p>
                      </div>
                      <p className={`${desk.label} mb-0 shrink-0 pt-1 text-right`}>
                        {formatEventClock(event.date, timeZone)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
