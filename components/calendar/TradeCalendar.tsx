"use client";

import { TradeDetailCard } from "@/components/trade-journal/TradeDetailCard";
import { TradeForm } from "@/components/trade-journal/TradeForm";
import { usePersistedTrades } from "@/components/trade-journal/usePersistedTrades";
import {
  buildStartingEquityByDay,
  computeDayStats,
  computePeriodStats,
  formatDayMetric,
  formatTradeCount,
  formatWeekHeading,
  formatWinRate,
  groupTradesByDay,
  loadCalendarDisplayMetric,
  loadCalendarRange,
  monthPeriodBounds,
  saveCalendarDisplayMetric,
  saveCalendarRange,
  startingEquityForDay,
  tradesInDateRange,
  weekDaysFromDate,
  weekPeriodBounds,
  type CalendarDisplayMetric,
  type CalendarRange,
  type DayStats,
  type DayTone,
  type PeriodStats,
} from "@/lib/trades/day-stats";
import {
  addLocalDays,
  dateKeyFromDate,
  formatCalendarDateLabel,
  formatLocalMonthYear,
  startOfLocalWeek,
} from "@/lib/time";
import type { TradingAccount } from "@/lib/types/account";
import type { Trade, TradeFormData } from "@/lib/types/trade";
import { ChevronLeft, ChevronRight, NotebookPen, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  return formatLocalMonthYear(date);
}

function formatSelectedLabel(dateKey: string) {
  return formatCalendarDateLabel(dateKey);
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

function RangeToggle({
  value,
  onChange,
}: {
  value: CalendarRange;
  onChange: (value: CalendarRange) => void;
}) {
  return (
    <div
      className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1"
      role="group"
      aria-label="Calendar range"
    >
      {(
        [
          { id: "week", label: "Weekly" },
          { id: "month", label: "Monthly" },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
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

function PeriodSummaryCard({
  stats,
  metric,
}: {
  stats: PeriodStats;
  metric: CalendarDisplayMetric;
}) {
  return (
    <section className={`rounded-xl border px-4 py-4 ${dayToneCardClass[stats.tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {stats.label}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {metric === "percent" ? "Return" : "Net P/L"}
          </p>
          <p
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${dayToneMetricClass[stats.tone]}`}
          >
            {formatDayMetric(stats, metric)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Trades
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-100">
            {formatTradeCount(stats.tradeCount)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Win rate
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-100">
            {formatWinRate(stats.winRate)}
          </p>
        </div>
      </div>
    </section>
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
  accounts: TradingAccount[];
  accountBalances: Record<string, number>;
  defaultAccountId: string;
  error: string | null;
  onSubmit: (data: TradeFormData) => void | Promise<void>;
  onClose: () => void;
};

function DayDetailModal({
  dateKey,
  trades,
  stats,
  metric,
  accounts,
  accountBalances,
  defaultAccountId,
  error,
  onSubmit,
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
        aria-label="Close day journal"
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
                ? "Journal trades for this calendar day. The entry date is set automatically."
                : `${formatTradeCount(trades.length)} logged — add another below if you are catching up.`}
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
          {error && (
            <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          )}

          {stats && (
            <div className="mb-5">
              <DaySummaryCards stats={stats} metric={metric} />
            </div>
          )}

          <TradeForm
            key={dateKey}
            embedded
            entryDateKey={dateKey}
            accounts={accounts}
            accountBalances={accountBalances}
            defaultAccountId={defaultAccountId}
            submitLabel="Save to this day"
            onSubmit={onSubmit}
          />

          {trades.length === 0 ? (
            <p className="mt-5 pb-2 text-center text-sm text-zinc-500">
              No trades on this day yet. Save one above and it will land on this
              calendar box.
            </p>
          ) : (
            <ul className="mt-6 space-y-5 border-t border-white/10 pt-5 pb-2">
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
  const {
    trades,
    accounts,
    activeAccount,
    accountBalances,
    isLoaded,
    error,
    handleSubmit,
  } = usePersistedTrades();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [modalDateKey, setModalDateKey] = useState<string | null>(null);
  const [metric, setMetric] = useState<CalendarDisplayMetric>("dollar");
  const [range, setRange] = useState<CalendarRange>("month");

  useEffect(() => {
    setMetric(loadCalendarDisplayMetric());
    setRange(loadCalendarRange());
  }, []);

  const closeModal = useCallback(() => setModalDateKey(null), []);
  const startingBalance = activeAccount?.startingBalance ?? 0;

  const tradesByDay = useMemo(() => groupTradesByDay(trades), [trades]);
  const equityByDay = useMemo(
    () => buildStartingEquityByDay(tradesByDay, startingBalance),
    [tradesByDay, startingBalance]
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );
  const weekDays = useMemo(() => weekDaysFromDate(viewDate), [viewDate]);
  const visibleDays = range === "week" ? weekDays : calendarDays;
  const weekBounds = useMemo(() => weekPeriodBounds(viewDate), [viewDate]);

  const periodCards = useMemo(() => {
    const month = monthPeriodBounds(viewDate);
    const thisWeek = weekPeriodBounds(new Date());
    const selectedWeek = weekBounds;
    const monthTrades = tradesInDateRange(trades, month.startKey, month.endKey);
    const thisWeekTrades = tradesInDateRange(
      trades,
      thisWeek.startKey,
      thisWeek.endKey
    );
    const selectedWeekTrades = tradesInDateRange(
      trades,
      selectedWeek.startKey,
      selectedWeek.endKey
    );

    return {
      month: computePeriodStats(
        monthTrades,
        startingEquityForDay(
          monthTrades,
          month.startKey,
          equityByDay,
          startingBalance
        ),
        formatMonthLabel(viewDate),
        month.startKey,
        month.endKey
      ),
      thisWeek: computePeriodStats(
        thisWeekTrades,
        startingEquityForDay(
          thisWeekTrades,
          thisWeek.startKey,
          equityByDay,
          startingBalance
        ),
        "This week",
        thisWeek.startKey,
        thisWeek.endKey
      ),
      selectedWeek: computePeriodStats(
        selectedWeekTrades,
        startingEquityForDay(
          selectedWeekTrades,
          selectedWeek.startKey,
          equityByDay,
          startingBalance
        ),
        formatWeekHeading(selectedWeek.start, selectedWeek.end),
        selectedWeek.startKey,
        selectedWeek.endKey
      ),
    };
  }, [equityByDay, startingBalance, trades, viewDate, weekBounds]);

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

  const goToPrevious = () => {
    if (range === "week") {
      setViewDate((prev) => addLocalDays(startOfLocalWeek(prev), -7));
      return;
    }
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const goToNext = () => {
    if (range === "week") {
      setViewDate((prev) => addLocalDays(startOfLocalWeek(prev), 7));
      return;
    }
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    const today = new Date();
    setViewDate(today);
    setModalDateKey(dateKeyFromDate(today));
  };

  const handleMetricChange = (next: CalendarDisplayMetric) => {
    setMetric(next);
    saveCalendarDisplayMetric(next);
  };

  const handleRangeChange = (next: CalendarRange) => {
    setRange(next);
    saveCalendarRange(next);
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
                {range === "week"
                  ? formatWeekHeading(weekBounds.start, weekBounds.end)
                  : formatMonthLabel(viewDate)}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {activeAccount
                  ? `${activeAccount.name} — click any date to journal trades for that day.`
                  : "Click any date to journal trades for that day."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RangeToggle value={range} onChange={handleRangeChange} />
              <MetricToggle value={metric} onChange={handleMetricChange} />
              <button
                type="button"
                onClick={goToPrevious}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
                aria-label={range === "week" ? "Previous week" : "Previous month"}
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
                onClick={goToNext}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
                aria-label={range === "week" ? "Next week" : "Next month"}
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

            {visibleDays.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className={`rounded-lg bg-transparent ${
                      range === "week"
                        ? "min-h-[8.5rem] sm:min-h-[10.5rem]"
                        : "min-h-[6.25rem] sm:min-h-[7.75rem]"
                    }`}
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

              const cellHeight =
                range === "week"
                  ? "min-h-[8.5rem] sm:min-h-[10.5rem]"
                  : "min-h-[6.25rem] sm:min-h-[7.75rem]";
              let cellClass =
                `relative flex ${cellHeight} flex-col rounded-lg border p-1.5 text-left transition-all sm:p-2.5 `;

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
                ? `${date.getDate()}, ${metricLabel}, ${formatTradeCount(stats.tradeCount)}. Click to journal trades for this day.`
                : `${date.getDate()}, no trades. Click to journal trades for this day.`;

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

                  {stats ? (
                    <div className="mt-auto space-y-0.5 sm:space-y-1">
                      <p
                        className={`truncate font-mono text-[11px] font-semibold leading-tight tabular-nums sm:text-sm ${dayToneMetricClass[stats.tone]}`}
                      >
                        {metricLabel}
                      </p>
                      <p className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
                        {formatTradeCount(stats.tradeCount)}
                      </p>
                    </div>
                  ) : (
                    <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 sm:text-xs">
                      <NotebookPen className="h-3 w-3" />
                      Log
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Performance
            </p>
            <div className={`grid gap-3 ${range === "month" ? "lg:grid-cols-2" : ""}`}>
              {range === "week" ? (
                <PeriodSummaryCard stats={periodCards.selectedWeek} metric={metric} />
              ) : (
                <>
                  <PeriodSummaryCard stats={periodCards.thisWeek} metric={metric} />
                  <PeriodSummaryCard stats={periodCards.month} metric={metric} />
                </>
              )}
            </div>
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
          accounts={accounts}
          accountBalances={accountBalances}
          defaultAccountId={activeAccount?.id ?? accounts[0]?.id ?? ""}
          error={error}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </>
  );
}
