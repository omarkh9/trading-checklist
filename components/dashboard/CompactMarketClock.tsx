"use client";

import { getMarketClock } from "@/lib/markets/sessions";
import { getUserTimeZone } from "@/lib/time";
import { useEffect, useState } from "react";

function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || getUserTimeZone();
  } catch {
    return getUserTimeZone();
  }
}

function formatLocalClock(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

function statusTone(isOpen: boolean, hasSession: boolean, isOverlap: boolean) {
  if (!isOpen) return "bg-rose-500";
  if (!hasSession) return "bg-zinc-500";
  if (isOverlap) return "bg-amber-400";
  return "bg-emerald-500";
}

function statusText(isOpen: boolean, hasSession: boolean, isOverlap: boolean) {
  if (!isOpen) return "text-rose-300";
  if (!hasSession) return "text-zinc-300";
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
      <div className="h-12 animate-pulse rounded-lg border border-white/10 bg-[#12121a]" />
    );
  }

  const clock = getMarketClock(now, userTimeZone);
  const hasSession = clock.activeSessions.length > 0;
  const sessionLabel = clock.isOpen
    ? hasSession
      ? clock.label.replace("Asia / ", "")
      : "Between sessions"
    : "Closed";
  const zoneLabel =
    clock.userTimeZoneLong && clock.userTimeZoneShort
      ? `${clock.userTimeZoneLong} / ${clock.userTimeZoneShort}`
      : clock.userTimeZoneShort;
  const title = [
    formatLocalClock(userTimeZone, now),
    zoneLabel,
    clock.nextChangeLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className={`rounded-lg border border-indigo-400/15 bg-[#12121a] ${
        variant === "compact" ? "px-2.5 py-1.5" : "px-2.5 py-2"
      }`}
      title={title}
      aria-label={`Market sessions. Local time ${formatLocalClock(userTimeZone, now)} ${zoneLabel}. ${sessionLabel}. ${clock.nextChangeLabel ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${statusTone(clock.isOpen, hasSession, clock.isOverlap)}`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${statusTone(clock.isOpen, hasSession, clock.isOverlap)}`}
          />
        </span>
        <p
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${statusText(clock.isOpen, hasSession, clock.isOverlap)}`}
        >
          {sessionLabel}
        </p>
        <p className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-200">
          {formatLocalClock(userTimeZone, now)}
        </p>
      </div>
      {variant !== "compact" && (
        <div className="mt-1 flex items-baseline justify-between gap-2 pl-4 text-[10px] leading-tight text-zinc-500">
          <p className="min-w-0 truncate">{clock.nextChangeLabel}</p>
          <p className="shrink-0">{clock.userTimeZoneShort}</p>
        </div>
      )}
    </section>
  );
}
