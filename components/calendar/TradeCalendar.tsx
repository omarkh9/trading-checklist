"use client";

import { TradeDetailCard } from "@/components/trade-journal/TradeDetailCard";
import { loadAccountSettings } from "@/lib/trades/account-balance";
import {
  buildStartingEquityByDay,
  computeDayStats,
  formatDayMetric,
  formatTradeCount,
  formatWinRate,
  groupTradesByDay,
  loadCalendarDisplayMetric,
  saveCalendarDisplayMetric,
  startingEquityForDay,
  type CalendarDisplayMetric,
  type DayStats,
  type DayTone,
} from "@/lib/trades/day-stats";
import { dateKeyFromDate } from "@/lib/trades/load-trades";
import { fetchTrades } from "@/lib/supabase/trades";
import type { Trade } from "@/lib/types/trade";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const dayToneCellClass: Record<DayTone, string> = {
  positive:
    "border-emerald-400/50 bg-emerald-500/20 text-zinc-100 shadow-[0_0_16px_rgba(16,185,129,0.12)] hover:border-emerald-300/70 hover:bg-emerald-500/30",
  negative:
    "border-rose-400/50 bg-rose-500/20 text-zinc-100 shadow-[0_0_16px_rgba(244,63,94,0.12)] hover:border-rose-300/70 hover:bg-rose-500/30",
  breakeven:
    "border-sky-400/50 bg-sky-500/20 text-zinc-100 shadow-[0_0_16px_rgba(56,189,248,0.12)] hover:border-sky-300/70 hover:bg-sky-500/30",
};

const dayToneMetricClass: Record<DayTone, string> = {
  positive: "text-emerald-300",
  negative: "text-rose-300",
  breakeven: "text-sky-300",
};

const dayToneCardClass: Record<DayTone, string> = {
  positive: "border-emerald-400/45 bg-emerald-500/15",
  negative: "border-rose-400/45 bg-rose-500/15",
  breakeven: "border-blue-400/45 bg-blue-500/15",
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

function MetricToggle({
  value,
  onChange,
}: {
  value: CalendarDisplayMetric;
  onChange: (value: CalendarDisplayMetric) => void;
}) {
  return (
    <div
      className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1"
      role="group"
      aria-label="Calendar display metric"
    >
      {(
        [
          { id: "dollar", label: "$ P/L" },
          { id: "percent", label: "% Return" },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.id
              ? "bg-indigo-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.35)]"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DaySummaryCards({
  stats,
  metric,
}: {
  stats: DayStats;
  metric: CalendarDisplayMetric;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div
        className={`rounded-lg border px-3 py-2.5 ${dayToneCardClass[stats.tone]}`}
      >
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {metric === "percent" ? "Return" : "Net P/L"}
        </p>
        <p
          className={`mt-1 font-mono text-lg font-semibold tabular-nums ${dayToneMetricClass[stats.tone]}`}
        >
          {formatDayMetric(stats, metric)}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Trades
        </p>
        <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">
          {formatTradeCount(stats.tradeCount)}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Win rate
        </p>
        <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">
          {formatWinRate(stats.winRate)}
        </p>
      </div>
    </div>
  );
}

type DayDetailModalProps = {
  dateKey: string;
  trades: Trade[];
  stats: DayStats | null;
  metric: CalendarDisplayMetric;
  onClose: () => void;
};

function DayDetailModal({
  dateKey,
  trades,
  stats,
  metric,
  onClose,
}: DayDetailModalProps) {
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
        className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[min(92vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-indigo-400/25 bg-[#0c0c16] shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:inset-x-6"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-indigo-400/15 px-5 py-4">
          <div>
            <h3 id="day-detail-title" className="text-lg font-semibold text-zinc-100">
              {formatSelectedLabel(dateKey)}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {trades.length === 0
                ? "No trades logged on this day."
                : `${formatTradeCount(trades.length)} logged`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {stats && (
            <div className="mb-5">
              <DaySummaryCards stats={stats} metric={metric} />
            </div>
          )}

          {trades.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">
                Log a trade in the journal to see it on your calendar.
              </p>
              <Link
                href="/trade-journal"
                onClick={onClose}
                className="mt-4 inline-flex text-sm font-medium text-indigo-300 transition-colors hover:text-white"
              >
                Go to Trade Journal →
              </Link>
            </div>
          ) : (
            <ul className="space-y-5 pb-2">
              {trades.map((trade, index) => (
                <li key={trade.id}>
                  {trades.length > 1 && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Trade {index + 1} of {trades.length}
                    </p>
                  )}
                  <TradeDetailCard trade={trade} />
                </li>
              ))}
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
  const [startingBalance, setStartingBalance] = useState(
    () => loadAccountSettings().startingBalance
  );
  const [metric, setMetric] = useState<CalendarDisplayMetric>("dollar");

  useEffect(() => {
    setStartingBalance(loadAccountSettings().startingBalance);
    setMetric(loadCalendarDisplayMetric());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextTrades = await fetchTrades();
        if (!cancelled) setTrades(nextTrades);
      } catch {
        if (!cancelled) setTrades([]);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    void load();
    const onFocus = () => {
      void load();
      setStartingBalance(loadAccountSettings().startingBalance);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const tradesByDay = useMemo(() => groupTradesByDay(trades), [trades]);
  const equityByDay = useMemo(
    () => buildStartingEquityByDay(tradesByDay, startingBalance),
    [tradesByDay, startingBalance]
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const todayKey = dateKeyFromDate(new Date());
  const modalTrades = modalDateKey
    ? (tradesByDay.get(modalDateKey) ?? [])
    : [];
  const modalStats =
    modalDateKey && modalTrades.length > 0
      ? computeDayStats(
          modalTrades,
          startingEquityForDay(
            modalTrades,
            modalDateKey,
            equityByDay,
            startingBalance
          )
        )
      : null;

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

  const handleMetricChange = (next: CalendarDisplayMetric) => {
    setMetric(next);
    saveCalendarDisplayMetric(next);
  };

  if (!isLoaded) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 rounded-2xl bg-[#0c0c16]/80" />
        <div className="h-96 rounded-2xl bg-[#0c0c16]/80" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0c0c16]/90 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
                {formatMonthLabel(viewDate)}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Days are colored by net P/L. Click a date for full details.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MetricToggle value={metric} onChange={handleMetricChange} />
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
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
                    className="min-h-[6.75rem] rounded-lg bg-transparent sm:min-h-[8.25rem]"
                    aria-hidden
                  />
                );
              }

              const key = dateKeyFromDate(date);
              const dayTrades = tradesByDay.get(key) ?? [];
              const isToday = key === todayKey;
              const hasTrades = dayTrades.length > 0;
              const stats = hasTrades
                ? computeDayStats(
                    dayTrades,
                    startingEquityForDay(
                      dayTrades,
                      key,
                      equityByDay,
                      startingBalance
                    )
                  )
                : null;

              let cellClass =
                "relative flex min-h-[6.75rem] flex-col rounded-lg border p-1.5 text-left transition-all sm:min-h-[8.25rem] sm:p-2.5 ";

              if (!hasTrades || !stats) {
                cellClass +=
                  "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-indigo-400/30 hover:bg-indigo-500/5";
              } else {
                cellClass += dayToneCellClass[stats.tone];
              }

              if (isToday) {
                cellClass +=
                  " ring-2 ring-indigo-300/80 ring-offset-2 ring-offset-[#0c0c16]";
              }

              const metricLabel = stats ? formatDayMetric(stats, metric) : "";
              const ariaLabel = stats
                ? `${date.getDate()}, ${metricLabel}, ${formatTradeCount(stats.tradeCount)}, ${formatWinRate(stats.winRate)} win rate`
                : `${date.getDate()}, no trades`;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModalDateKey(key)}
                  className={cellClass}
                  aria-label={ariaLabel}
                >
                  <span
                    className={`text-[11px] font-semibold sm:text-sm ${
                      isToday && !hasTrades ? "text-indigo-300" : "text-zinc-200"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {stats && (
                    <div className="mt-auto space-y-0.5 sm:space-y-1">
                      <p
                        className={`truncate font-mono text-[11px] font-semibold leading-tight tabular-nums sm:text-sm ${dayToneMetricClass[stats.tone]}`}
                      >
                        {metricLabel}
                      </p>
                      <p className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
                        {formatTradeCount(stats.tradeCount)}
                      </p>
                      <p className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
                        {formatWinRate(stats.winRate)}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs text-zinc-500">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-emerald-400/55 bg-emerald-500/20" />
              Profitable day
            </span>
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-rose-400/55 bg-rose-500/20" />
              Losing day
            </span>
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-blue-400/55 bg-blue-500/20" />
              Break-even day
            </span>
          </div>
          </div>
        </div>
      </div>

      {modalDateKey && (
        <DayDetailModal
          dateKey={modalDateKey}
          trades={modalTrades}
          stats={modalStats}
          metric={metric}
          onClose={() => setModalDateKey(null)}
        />
      )}
    </>
  );
}
