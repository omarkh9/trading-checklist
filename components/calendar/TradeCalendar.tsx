"use client";

import {
  dateKeyFromDate,
  loadTrades,
  tradeDateKey,
} from "@/lib/trades/load-trades";
import { formatPnlDollars } from "@/lib/trades/pnl";
import type { Direction, Outcome, Trade } from "@/lib/types/trade";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const outcomeFillClass: Record<Outcome, string> = {
  Win: "bg-emerald-500/35",
  Loss: "bg-rose-500/35",
  Breakeven: "bg-blue-500/35",
};

const outcomeCellClass: Record<Outcome, string> = {
  Win: "border-emerald-500/45 bg-emerald-500/35 text-zinc-100 hover:border-emerald-500/55 hover:bg-emerald-500/40",
  Loss: "border-rose-500/45 bg-rose-500/35 text-zinc-100 hover:border-rose-500/55 hover:bg-rose-500/40",
  Breakeven:
    "border-blue-500/45 bg-blue-500/35 text-zinc-100 hover:border-blue-500/55 hover:bg-blue-500/40",
};

const outcomeBadgeClass: Record<Outcome, string> = {
  Win: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  Loss: "bg-red-500/15 text-red-400 ring-red-500/30",
  Breakeven: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
};

const directionStyles: Record<Direction, string> = {
  Long: "text-emerald-400",
  Short: "text-red-400",
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

function ChartPreview({
  label,
  src,
}: {
  label: string;
  src: string | null;
}) {
  if (!src) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="max-h-56 w-full object-cover"
        />
      </div>
    </div>
  );
}

type DayDetailModalProps = {
  dateKey: string;
  trades: Trade[];
  onClose: () => void;
};

function DayDetailModal({ dateKey, trades, onClose }: DayDetailModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close day details"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-title"
        className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl sm:inset-x-auto"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 id="day-detail-title" className="text-lg font-semibold text-zinc-100">
              {formatSelectedLabel(dateKey)}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {trades.length === 0
                ? "No trades logged on this day."
                : `${trades.length} ${
                    trades.length === 1 ? "trade" : "trades"
                  } logged`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-zinc-400 transition-colors hover:bg-surface-overlay hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {trades.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-overlay/30 px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">
                Log a trade in the journal to see it on your calendar.
              </p>
              <Link
                href="/trade-journal"
                onClick={onClose}
                className="mt-4 inline-flex text-sm font-medium text-accent-hover hover:text-white"
              >
                Go to Trade Journal →
              </Link>
            </div>
          ) : (
            <ul className="space-y-6">
              {trades.map((trade) => {
                const chartFields = [
                  ["Higher Time Frame", trade.higherTimeFrame],
                  ["Middle Time Frame", trade.middleTimeFrame],
                  ["Lower Time Frame", trade.lowerTimeFrame],
                  ["Entry", trade.entry],
                  ["Before Chart (Setup)", trade.beforeChart],
                  ["After Chart (Result)", trade.afterChart],
                ] as const;
                const charts = chartFields.filter(([, src]) => src);

                return (
                  <li
                    key={trade.id}
                    className="rounded-xl border border-border bg-surface-overlay/40 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold text-zinc-100">
                          {trade.pair}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatTradeTime(trade.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${outcomeBadgeClass[trade.outcome]}`}
                      >
                        {trade.outcome}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
                        <dt className="text-xs text-zinc-500">Direction</dt>
                        <dd
                          className={`text-sm font-medium ${directionStyles[trade.direction]}`}
                        >
                          {trade.direction}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
                        <dt className="text-xs text-zinc-500">Entry Price</dt>
                        <dd className="font-mono text-sm text-zinc-200">
                          {trade.entryPrice || "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
                        <dt className="text-xs text-zinc-500">Stop Loss</dt>
                        <dd className="font-mono text-sm text-zinc-200">
                          {trade.stopLoss || "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
                        <dt className="text-xs text-zinc-500">Take Profit</dt>
                        <dd className="font-mono text-sm text-zinc-200">
                          {trade.takeProfit || "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
                        <dt className="text-xs text-zinc-500">P/L</dt>
                        <dd
                          className={`font-mono text-sm ${
                            trade.pnlDollars > 0
                              ? "text-emerald-400"
                              : trade.pnlDollars < 0
                                ? "text-rose-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {formatPnlDollars(trade.pnlDollars ?? 0)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-overlay/60 px-3 py-2">
                        <dt className="text-xs text-zinc-500">Lot Size</dt>
                        <dd className="font-mono text-sm text-zinc-200">
                          {trade.lotSize || "—"}
                        </dd>
                      </div>
                    </dl>

                    {trade.notes.trim() && (
                      <div className="mt-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Notes
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                          {trade.notes}
                        </p>
                      </div>
                    )}

                    {charts.length > 0 && (
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {charts.map(([label, src]) => (
                          <ChartPreview key={label} label={label} src={src} />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export function TradeCalendar() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [modalDateKey, setModalDateKey] = useState<string | null>(null);

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
  const modalTrades = modalDateKey
    ? (tradesByDay.get(modalDateKey) ?? [])
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
    setModalDateKey(dateKeyFromDate(today));
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
    <>
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border border-border bg-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                {formatMonthLabel(viewDate)}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Days are colored by trade outcome. Click a date for full
                details.
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
              const isToday = key === todayKey;
              const hasTrades = dayTrades.length > 0;
              const singleOutcome =
                dayTrades.length === 1 ? dayTrades[0].outcome : null;

              let cellClass =
                "relative flex min-h-[4.5rem] flex-col overflow-hidden rounded-lg border p-2 text-left transition-all sm:min-h-[5.5rem] sm:p-3 ";

              if (!hasTrades) {
                cellClass +=
                  "border-border bg-surface-overlay/40 hover:border-border/80 hover:bg-surface-overlay text-zinc-200";
              } else if (singleOutcome) {
                cellClass += outcomeCellClass[singleOutcome];
              } else {
                cellClass +=
                  "border-border bg-surface-overlay/80 p-0 hover:border-zinc-500/40";
              }

              if (isToday) {
                cellClass += " ring-2 ring-white/90 ring-offset-2 ring-offset-surface-raised";
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModalDateKey(key)}
                  className={cellClass}
                  aria-label={`${date.getDate()}, ${dayTrades.length} trades`}
                >
                  {hasTrades && dayTrades.length > 1 && (
                    <div className="absolute inset-0 flex flex-col">
                      {dayTrades.map((trade) => (
                        <div
                          key={trade.id}
                          className={`min-h-0 flex-1 ${outcomeFillClass[trade.outcome]}`}
                          title={`${trade.pair} — ${trade.outcome}`}
                        />
                      ))}
                    </div>
                  )}

                  <span
                    className={`relative z-10 text-sm font-bold ${
                      hasTrades
                        ? singleOutcome
                          ? ""
                          : "rounded-md bg-surface-raised/90 px-1.5 py-0.5 text-zinc-200 ring-1 ring-border/80"
                        : isToday
                          ? "text-accent-hover"
                          : ""
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {hasTrades && dayTrades.length > 1 && (
                    <span className="relative z-10 mt-auto self-end rounded bg-surface-raised/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 ring-1 ring-border/80">
                      {dayTrades.length} trades
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-zinc-500">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-emerald-500/45 bg-emerald-500/35" />
              Win day
            </span>
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-rose-500/45 bg-rose-500/35" />
              Loss day
            </span>
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-blue-500/45 bg-blue-500/35" />
              Breakeven day
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-5 w-5 overflow-hidden rounded border border-border">
                <span className="flex-1 bg-emerald-500/35" />
                <span className="flex-1 bg-rose-500/35" />
              </span>
              Multiple trades (split by outcome)
            </span>
          </div>
        </div>
      </div>

      {modalDateKey && (
        <DayDetailModal
          dateKey={modalDateKey}
          trades={modalTrades}
          onClose={() => setModalDateKey(null)}
        />
      )}
    </>
  );
}
