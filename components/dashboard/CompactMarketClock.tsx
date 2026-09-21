"use client";

import { getMarketClock, type SessionId } from "@/lib/markets/sessions";
import { getUserTimeZone } from "@/lib/time";
import { useEffect, useState } from "react";

const WORLD_CLOCKS = [
  { id: "sydney" as const satisfies SessionId, label: "Sydney", short: "Syd", timeZone: "Australia/Sydney" },
  { id: "tokyo" as const satisfies SessionId, label: "Tokyo", short: "Tyo", timeZone: "Asia/Tokyo" },
  { id: "london" as const satisfies SessionId, label: "London", short: "Lon", timeZone: "Europe/London" },
  { id: "newyork" as const satisfies SessionId, label: "New York", short: "NY", timeZone: "America/New_York" },
];

function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || getUserTimeZone();
  } catch {
    return getUserTimeZone();
  }
}

function formatClock(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

function statusTone(isOpen: boolean, isOverlap: boolean) {
  if (!isOpen) return "bg-rose-500";
  if (isOverlap) return "bg-amber-400";
  return "bg-emerald-500";
}

function statusText(isOpen: boolean, isOverlap: boolean) {
  if (!isOpen) return "text-rose-300";
  if (isOverlap) return "text-amber-200";
  return "text-emerald-300";
}

export function CompactMarketClock({
  variant = "panel",
}: {
  variant?: "panel" | "compact";
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [userTimeZone, setUserTimeZone] = useState<string | null>(null);

  useEffect(() => {
    setUserTimeZone(detectBrowserTimeZone());
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now || !userTimeZone) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-white/10 bg-[#12121a]" />
    );
  }

  const clock = getMarketClock(now, userTimeZone);
  const activeIds = new Set(clock.activeSessions.map((session) => session.id));
  const sessionById = new Map(
    clock.sessions.map((session) => [session.id, session])
  );

  if (variant === "compact") {
    return (
      <div
        className="flex max-w-full items-center gap-2 rounded-lg border border-indigo-400/15 bg-[#12121a] px-2.5 py-1.5"
        title={clock.nextChangeLabel ?? clock.label}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${statusTone(clock.isOpen, clock.isOverlap)}`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${statusTone(clock.isOpen, clock.isOverlap)}`}
          />
        </span>
        <span className={`text-[11px] font-semibold ${statusText(clock.isOpen, clock.isOverlap)}`}>
          {clock.isOpen ? clock.label.replace("Asia / ", "") : "Closed"}
        </span>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-indigo-400/20 bg-[#12121a] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        Market sessions
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${statusTone(clock.isOpen, clock.isOverlap)}`}
          />
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusTone(clock.isOpen, clock.isOverlap)}`}
          />
        </span>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${statusText(clock.isOpen, clock.isOverlap)}`}>
            {clock.isOpen ? clock.label.replace("Asia / ", "") : "Market closed"}
          </p>
          <p className="text-[11px] leading-snug text-zinc-400">
            {clock.nextChangeLabel ?? `Times in ${clock.userTimeZoneShort}`}
          </p>
        </div>
      </div>
      <p className="mt-2 flex items-baseline justify-between gap-2 text-[11px] text-zinc-500">
        <span>Local {clock.userTimeZoneShort}</span>
        <span className="font-mono tabular-nums text-zinc-200">
          {formatClock(userTimeZone, now)}
        </span>
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {WORLD_CLOCKS.map((city) => {
          const session = sessionById.get(city.id);
          return (
            <li
              key={city.id}
              className={`rounded-lg border px-2 py-1.5 ${
                activeIds.has(city.id)
                  ? "border-emerald-400/25 bg-emerald-500/10 text-zinc-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-400"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {city.short}
              </p>
              <p className="font-mono text-xs tabular-nums text-zinc-100">
                {formatClock(city.timeZone, now)}
              </p>
              {session && (
                <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">
                  {session.localRange}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
