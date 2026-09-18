"use client";

import {
  dateKeyFromDate,
  loadTrades,
  tradeDateKey,
} from "@/lib/trades/load-trades";
import type { Outcome, Trade } from "@/lib/types/trade";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const outcomeDotClass: Record<Outcome, string> = {
  Win: "bg-emerald-500",
  Loss: "bg-red-500",
  Breakeven: "bg-blue-500",
};

const outcomeBadgeClass: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Loss: "bg-red-500/15 text-red-400 ring-red-500/30",
  Breakeven: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
};

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPadding = (firstOfMonth.getDay() + 6) % 7;

  const days: (Date | null)[] = Array.from({ length: startPadding }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }
  return days;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatSelectedLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTradeTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TradeCalendar() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() =>
    dateKeyFromDate(new Date())
  );

  const refreshTrades = () => setTrades(loadTrades());

  useEffect(() => {
    refreshTrades();
    setIsLoaded(true);

    const onStorage = () => refreshTrades();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
    };
  }, []);

  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const trade of trades) {
      const key = tradeDateKey(trade.createdAt);
      const list = map.get(key) ?? [];
      list.push(trade);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return map;
  }, [trades]);

  const calendarDays = useMemo(
    () => buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const todayKey = dateKeyFromDate(new Date());
  const selectedTrades = selectedDateKey
    ? (tradesByDay.get(selectedDateKey) ?? [])
    : [];

  const goToPreviousMonth = () => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    const today = new Date();
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(dateKeyFromDate(today));
  };

  if (!isLoaded) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 rounded-xl bg-surface-raised" />
        <div className="h-96 rounded-xl bg-surface-raised" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              {formatMonthLabel(viewDate)}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Click a date to review trades logged that day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-zinc-400 transition-colors hover:bg-surface-overlay hover:text-zinc-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-surface-overlay"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-zinc-400 transition-colors hover:bg-surface-overlay hover:text-zinc-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium uppercase tracking-wider text-zinc-500"
            >
              {day}
            </div>
          ))}

          {calendarDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[4.5rem] rounded-lg bg-transparent sm:min-h-[5.5rem]"
                  aria-hidden
                />
              );
            }

            const key = dateKeyFromDate(date);
            const dayTrades = tradesByDay.get(key) ?? [];
            const isSelected = selectedDateKey === key;
            const isToday = key === todayKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDateKey(key)}
                className={`flex min-h-[4.5rem] flex-col rounded-lg border p-2 text-left transition-all sm:min-h-[5.5rem] sm:p-3 ${
                  isSelected
                    ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30"
                    : "border-border bg-surface-overlay/40 hover:border-border/80 hover:bg-surface-overlay"
                } ${isToday && !isSelected ? "ring-1 ring-zinc-600" : ""}`}
              >
                <span
                  className={`text-sm font-semibold ${
                    isToday ? "text-accent-hover" : "text-zinc-200"
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayTrades.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1 pt-2">
                    {dayTrades.map((trade) => (
                      <span
                        key={trade.id}
                        className={`h-2 w-2 rounded-full ${outcomeDotClass[trade.outcome]}`}
                        title={`${trade.pair} — ${trade.outcome}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Win
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Loss
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Breakeven
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface-raised p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-zinc-100">
          {selectedDateKey
            ? formatSelectedLabel(selectedDateKey)
            : "Select a date"}
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          {selectedTrades.length === 0
            ? "No trades logged on this day."
            : `${selectedTrades.length} ${
                selectedTrades.length === 1 ? "trade" : "trades"
              } logged`}
        </p>

        {selectedTrades.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-surface-overlay/30 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">
              Log a trade in the journal to see it on your calendar.
            </p>
            <Link
              href="/trade-journal"
              className="mt-4 inline-flex text-sm font-medium text-accent-hover hover:text-white"
            >
              Go to Trade Journal →
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {selectedTrades.map((trade) => (
              <li
                key={trade.id}
                className="rounded-lg border border-border bg-surface-overlay/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-100">{trade.pair}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {trade.direction} · {formatTradeTime(trade.createdAt)}
                      {trade.entryPrice
                        ? ` · Entry ${trade.entryPrice}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${outcomeBadgeClass[trade.outcome]}`}
                  >
                    {trade.outcome}
                  </span>
                </div>
                {trade.notes.trim() && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    {trade.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
