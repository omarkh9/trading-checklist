"use client";

import { getMarketClock, type MarketClock } from "@/lib/markets/sessions";
import { useEffect, useState } from "react";

type SessionStatusProps = {
  variant?: "full" | "compact";
};

function useMarketClock(): MarketClock | null {
  const [clock, setClock] = useState<MarketClock | null>(null);

  useEffect(() => {
    const tick = () => setClock(getMarketClock(new Date()));
    tick();
    const id = window.setInterval(tick, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return clock;
}

function StatusDot({
  tone,
}: {
  tone: "closed" | "open" | "overlap";
}) {
  const color =
    tone === "closed"
      ? "bg-rose-500"
      : tone === "overlap"
        ? "bg-amber-400"
        : "bg-emerald-500";
  const ping =
    tone === "closed"
      ? "bg-rose-400"
      : tone === "overlap"
        ? "bg-amber-300"
        : "bg-emerald-400";

  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {tone !== "closed" && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ping}`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function statusTone(clock: MarketClock): "closed" | "open" | "overlap" {
  if (!clock.isOpen) return "closed";
  return clock.isOverlap ? "overlap" : "open";
}

function statusTextClass(clock: MarketClock): string {
  if (!clock.isOpen) return "text-rose-300";
  return clock.isOverlap ? "text-amber-200" : "text-emerald-300";
}

export function SessionStatus({ variant = "full" }: SessionStatusProps) {
  const clock = useMarketClock();

  if (!clock) {
    if (variant === "compact") {
      return (
        <div
          className="flex items-center gap-2 rounded-lg bg-surface-overlay px-2.5 py-1.5 ring-1 ring-border"
          aria-label="Detecting session status"
        >
          <span className="h-2 w-2 rounded-full bg-zinc-600" />
          <span className="text-xs font-medium text-zinc-500">Session…</span>
        </div>
      );
    }

    return (
      <div className="rounded-lg bg-surface-overlay p-3 ring-1 ring-border">
        <p className="text-xs font-medium text-zinc-400">Session Status</p>
        <p className="mt-2 text-sm text-zinc-500">Detecting market hours…</p>
      </div>
    );
  }

  const tone = statusTone(clock);
  const title = clock.isOpen
    ? clock.isOverlap
      ? `${clock.label} overlap`
      : `${clock.label} session`
    : clock.label;

  if (variant === "compact") {
    return (
      <div
        className="flex max-w-[14rem] items-center gap-2 rounded-lg bg-surface-overlay px-2.5 py-1.5 ring-1 ring-border"
        aria-label={`Session status: ${title}`}
        title={clock.nextChangeLabel ?? title}
      >
        <StatusDot tone={tone} />
        <span
          className={`truncate text-xs font-medium ${statusTextClass(clock)}`}
        >
          {clock.label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface-overlay p-3 ring-1 ring-border">
      <p className="text-xs font-medium text-zinc-400">Session Status</p>
      <div className="mt-2 flex items-start gap-2">
        <span className="mt-1.5">
          <StatusDot tone={tone} />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${statusTextClass(clock)}`}>
            {clock.label}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
            {clock.isOpen && clock.isOverlap
              ? `Overlap${clock.nextChangeLabel ? ` · ${clock.nextChangeLabel}` : ""}`
              : clock.nextChangeLabel}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
        {clock.sessions.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  session.active
                    ? clock.isOverlap
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                    : "bg-zinc-600"
                }`}
              />
              <span
                className={
                  session.active ? "font-medium text-zinc-200" : "text-zinc-500"
                }
              >
                {session.name}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-zinc-500">
              {session.localRange}
            </span>
          </li>
        ))}
      </ul>

      {clock.isOpen && clock.nextChangeLabel && (
        <p className="mt-2 text-[10px] text-zinc-600">
          Times in {clock.userTimeZoneShort}
        </p>
      )}
      {!clock.isOpen && (
        <p className="mt-2 text-[10px] text-zinc-600">
          Forex weekend · Fri 5:00 PM – Sun 5:00 PM ET
        </p>
      )}
    </div>
  );
}
