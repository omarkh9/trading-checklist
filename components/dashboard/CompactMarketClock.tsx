"use client";

import { getMarketClock, getZonedParts, MARKET_SESSIONS } from "@/lib/markets/sessions";
import { resolveDisplayTimeZone } from "@/lib/settings/workspace";
import { useWorkspaceSettings } from "@/components/workspace/WorkspaceProvider";
import { useEffect, useState } from "react";

const WORLD_CLOCKS = [
  { id: "syd", label: "Sydney", short: "Syd", timeZone: "Australia/Sydney" },
  { id: "tyo", label: "Tokyo", short: "Tyo", timeZone: "Asia/Tokyo" },
  { id: "lon", label: "London", short: "Lon", timeZone: "Europe/London" },
  { id: "ny", label: "New York", short: "NY", timeZone: "America/New_York" },
] as const;

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
  const { settings } = useWorkspaceSettings();
  const displayZone = resolveDisplayTimeZone(settings.timeZone);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-white/10 bg-[#12121a]" />
    );
  }

  const clock = getMarketClock(now, displayZone);
  const activeIds = new Set(
    MARKET_SESSIONS.filter((session) => {
      if (!clock.isOpen) return false;
      const local = getZonedParts(now, session.timeZone);
      return local.hour >= session.openHour && local.hour < session.closeHour;
    }).map((session) => session.timeZone)
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
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {WORLD_CLOCKS.map((city) => (
          <li
            key={city.id}
            className={`rounded-lg border px-2 py-1.5 ${
              activeIds.has(city.timeZone)
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
          </li>
        ))}
      </ul>
    </section>
  );
}
