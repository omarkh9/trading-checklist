"use client";

import { ImageDropzone } from "@/components/trade-journal/ImageDropzone";
import { EmotionPicker } from "@/components/trade-journal/EmotionPicker";
import { RuleScorePanel } from "@/components/trade-journal/RuleScorePanel";
import { VoiceNoteField } from "@/components/trade-journal/VoiceNoteField";
import { useCachedChecklist } from "@/components/pre-trade-checklist/useCachedChecklist";
import { useCachedTrades } from "@/components/trade-journal/useCachedTrades";
import { useWorkspaceSettings } from "@/components/workspace/WorkspaceProvider";
import { formatBalance, tradesForAccount } from "@/lib/trades/account-balance";
import {
  ASSET_CLASS_LABELS,
  listKnownSymbols,
  resolveAsset,
} from "@/lib/trades/assets";
import {
  analyzePositionRisk,
  formatPips,
  formatUsdCompact,
} from "@/lib/trades/contract-math";
import { loadQuoteToUsd } from "@/lib/trades/fx-rates";
import { calculateLotSize, formatLotSize } from "@/lib/trades/lot-size";
import { tradeDateKey } from "@/lib/trades/load-trades";
import {
  formatPnlDollars,
  parseNumericInput,
  resolveExitPrice,
  resolveLotsForPnl,
  resolveTradeResult,
} from "@/lib/trades/pnl";
import { computeRuleScore, resolveTradeRuleScore } from "@/lib/trades/rule-score";
import {
  emptyTradeForm,
  type PnlMode,
  type RiskSizeMode,
  type TradeFormData,
} from "@/lib/types/trade";
import type { TradingAccount } from "@/lib/types/account";
import { withDailyChecks } from "@/lib/types/checklist";
import { DeskCard } from "@/components/ui/DeskCard";
import { NumericDraftInput } from "@/components/ui/NumberField";
import { desk } from "@/lib/ui/desk";
import { formatCalendarDateLabel, isoTimestampForDateKey, localDateKey } from "@/lib/time";
import { ChevronDown, Save } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

type TradeFormProps = {
  accounts: TradingAccount[];
  accountBalances: Record<string, number>;
  defaultAccountId: string;
  onSubmit: (data: TradeFormData) => void | Promise<void>;
  initialData?: TradeFormData;
  onCancel?: () => void;
  submitLabel?: string;
  embedded?: boolean;
  entryDateKey?: string;
};

const KNOWN_SYMBOLS = listKnownSymbols();

const PNL_DRIVER_KEYS = new Set<keyof TradeFormData>([
  "pair",
  "direction",
  "entryPrice",
  "exitPrice",
  "stopLoss",
  "takeProfit",
  "lotSize",
  "fixedLotSize",
  "riskSizeMode",
]);

const inputClass = desk.input;
const labelClass = desk.label;

function DeskSelect<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${open ? "z-30" : ""}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span>{selected?.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-indigo-400/20 bg-[#12121a] py-1 text-zinc-100 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-indigo-500/20 text-indigo-200"
                      : "text-zinc-200 hover:bg-white/[0.06] hover:text-zinc-50"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.id
              ? "bg-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)]"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const TradeForm = memo(function TradeForm({
  accounts,
  accountBalances,
  defaultAccountId,
  onSubmit,
  initialData,
  onCancel,
  submitLabel = "Save Trade",
  embedded = false,
  entryDateKey,
}: TradeFormProps) {
  const { settings } = useWorkspaceSettings();
  const {
    rules: checklistRules,
    session: checklistSession,
    isLoaded: checklistLoaded,
  } = useCachedChecklist();
  const { trades: allTrades } = useCachedTrades();
  const [form, setForm] = useState<TradeFormData>(() => ({
    ...(initialData ?? emptyTradeForm()),
    accountId: initialData?.accountId || defaultAccountId,
    riskPercent:
      initialData?.riskPercent || String(settings.defaultRiskPercent),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [manualPnl, setManualPnl] = useState(
    () => Boolean(initialData?.pnlInput?.trim()) && !initialData?.exitPrice
  );
  const [quoteToUsd, setQuoteToUsd] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        ...initialData,
        accountId: initialData.accountId || defaultAccountId,
        checkedRuleIds: initialData.checkedRuleIds ?? [],
        ruleScore: initialData.ruleScore ?? null,
      });
      setManualPnl(
        Boolean(initialData.pnlInput?.trim()) && !initialData.exitPrice
      );
      return;
    }
    setForm((prev) => ({
      ...prev,
      accountId: defaultAccountId || prev.accountId,
    }));
  }, [initialData, defaultAccountId]);

  useEffect(() => {
    if (initialData || !checklistLoaded) return;
    setForm((prev) => {
      const nextIds =
        prev.checkedRuleIds.length > 0
          ? prev.checkedRuleIds
          : checklistSession.checkedRuleIds;
      const nextRisk =
        prev.riskPercent || String(settings.defaultRiskPercent);
      if (
        nextIds === prev.checkedRuleIds &&
        nextRisk === prev.riskPercent
      ) {
        return prev;
      }
      return {
        ...prev,
        riskPercent: nextRisk,
        checkedRuleIds: nextIds,
      };
    });
  }, [
    checklistLoaded,
    checklistSession.checkedRuleIds,
    initialData,
    settings.defaultRiskPercent,
  ]);

  const update = <K extends keyof TradeFormData>(
    key: K,
    value: TradeFormData[K]
  ) => {
    if (PNL_DRIVER_KEYS.has(key) && manualPnl) {
      setManualPnl(false);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const currentBalance = accountBalances[form.accountId] ?? 0;
  const fallbackId = accounts[0]?.id ?? "";
  const todayPnl = useMemo(() => {
    const today = localDateKey();
    return tradesForAccount(allTrades, form.accountId, fallbackId)
      .filter((trade) => tradeDateKey(trade.createdAt) === today)
      .reduce((sum, trade) => sum + (trade.pnlDollars ?? 0), 0);
  }, [allTrades, fallbackId, form.accountId]);

  const riskNumeric = parseNumericInput(form.riskPercent);
  const cappedRisk =
    riskNumeric == null
      ? settings.defaultRiskPercent
      : Math.min(riskNumeric, settings.maxRiskPercent);
  const riskCapped =
    riskNumeric != null && riskNumeric > settings.maxRiskPercent + 0.0001;

  const quoteCurrency = resolveAsset(form.pair).spec.quoteCurrency;
  const needsQuoteConversion =
    resolveAsset(form.pair).spec.usdConversion === "quote-to-usd";

  useEffect(() => {
    if (!needsQuoteConversion) {
      setQuoteToUsd(null);
      return;
    }
    let cancelled = false;
    void loadQuoteToUsd(quoteCurrency).then((rate) => {
      if (!cancelled) setQuoteToUsd(rate);
    });
    return () => {
      cancelled = true;
    };
  }, [needsQuoteConversion, quoteCurrency]);

  const calculatedLot = useMemo(
    () =>
      calculateLotSize({
        pair: form.pair,
        riskSizeMode: form.riskSizeMode,
        riskPercent: String(cappedRisk),
        fixedLotSize: form.fixedLotSize,
        entryPrice: form.entryPrice,
        stopLoss: form.stopLoss,
        accountBalance: currentBalance,
        quoteToUsd,
      }),
    [
      form.pair,
      form.riskSizeMode,
      form.fixedLotSize,
      form.entryPrice,
      form.stopLoss,
      cappedRisk,
      currentBalance,
      quoteToUsd,
    ]
  );

  const lotsForPnl = resolveLotsForPnl({
    lotSize: form.lotSize,
    fixedLotSize: form.fixedLotSize,
    calculatedLot,
  });
  const hasExplicitExit = Boolean(form.exitPrice.trim());
  const exitForPnl = resolveExitPrice(
    form.exitPrice,
    form.takeProfit,
    form.stopLoss,
    form.outcome
  );

  const resolvedAsset = useMemo(() => resolveAsset(form.pair), [form.pair]);

  const positionRisk = useMemo(() => {
    const entry = parseNumericInput(form.entryPrice);
    const stop = parseNumericInput(form.stopLoss);
    const takeProfit = parseNumericInput(form.takeProfit);
    if (entry === null || stop === null) return null;
    return analyzePositionRisk({
      pair: form.pair,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit,
      quoteToUsd,
    });
  }, [form.pair, form.entryPrice, form.stopLoss, form.takeProfit, quoteToUsd]);

  const sizedRiskUsd =
    lotsForPnl != null && positionRisk
      ? lotsForPnl * positionRisk.riskPerLotUsd
      : null;
  const sizedRewardUsd =
    lotsForPnl != null && positionRisk?.rewardPerLotUsd != null
      ? lotsForPnl * positionRisk.rewardPerLotUsd
      : null;

  const tradeResult = useMemo(
    () =>
      resolveTradeResult({
        pair: form.pair,
        direction: form.direction,
        entryPrice: form.entryPrice,
        exitPrice: exitForPnl,
        lots: lotsForPnl,
        quoteToUsd,
        outcome: form.outcome,
        pnlMode: form.pnlMode,
        pnlInput: form.pnlInput,
        balanceBeforeTrade: currentBalance,
        preferAuto: !manualPnl,
        hasExplicitExit,
        fallbackLossUsd: sizedRiskUsd,
        fallbackWinUsd: sizedRewardUsd,
      }),
    [
      currentBalance,
      exitForPnl,
      form.direction,
      form.entryPrice,
      form.outcome,
      form.pair,
      form.pnlInput,
      form.pnlMode,
      hasExplicitExit,
      lotsForPnl,
      manualPnl,
      quoteToUsd,
      sizedRewardUsd,
      sizedRiskUsd,
    ]
  );

  useEffect(() => {
    if (manualPnl || !tradeResult.autoCalculated) return;
    if (form.outcome === tradeResult.outcome) return;
    if (!hasExplicitExit && (form.outcome === "Loss" || form.outcome === "Win")) {
      return;
    }
    setForm((prev) => ({ ...prev, outcome: tradeResult.outcome }));
  }, [
    form.outcome,
    hasExplicitExit,
    manualPnl,
    tradeResult.autoCalculated,
    tradeResult.outcome,
  ]);
  const rewardRiskRatio =
    sizedRiskUsd != null && sizedRewardUsd != null && sizedRiskUsd > 0
      ? sizedRewardUsd / sizedRiskUsd
      : null;
  const autoPnlInput = tradeResult.autoCalculated
    ? Math.abs(tradeResult.pnlDollars).toFixed(2)
    : "";
  const pnlInputValue = manualPnl ? form.pnlInput : autoPnlInput;
  const pnlModeValue = manualPnl ? form.pnlMode : "dollar";
  const exitSourceLabel = form.exitPrice.trim()
    ? "exit"
    : form.outcome === "Loss" && form.stopLoss.trim()
      ? "stop loss"
      : form.outcome === "Win" && form.takeProfit.trim()
        ? "take profit"
        : form.takeProfit.trim()
          ? "take profit"
          : form.stopLoss.trim()
            ? "stop loss"
            : null;

  const displayLotSize =
    form.riskSizeMode === "fixed"
      ? form.fixedLotSize || "—"
      : formatLotSize(calculatedLot);

  const activeCheckedIds =
    form.checkedRuleIds.length > 0
      ? form.checkedRuleIds
      : initialData?.checkedRuleIds ?? [];
  const checklistItems = useMemo(
    () =>
      withDailyChecks(checklistRules, {
        ...checklistSession,
        checkedRuleIds: activeCheckedIds,
      }),
    [activeCheckedIds, checklistRules, checklistSession]
  );
  const liveRuleScore = computeRuleScore(checklistRules, activeCheckedIds);
  const ruleScore =
    form.checkedRuleIds.length > 0 || !initialData
      ? liveRuleScore ?? initialData?.ruleScore ?? form.ruleScore ?? null
      : resolveTradeRuleScore(
          {
            ruleScore: form.ruleScore ?? initialData?.ruleScore ?? null,
            checkedRuleIds: activeCheckedIds,
          },
          checklistRules
        );
  const dailyLossLimit =
    currentBalance > 0
      ? currentBalance * (settings.dailyLossLimitPercent / 100)
      : 0;
  const dailyLimitHit =
    dailyLossLimit > 0 && todayPnl <= -dailyLossLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pair.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSubmit({
        ...form,
        strategy: form.strategy.trim(),
        outcome: tradeResult.outcome,
        pnlDollars: tradeResult.pnlDollars,
        pnlInput: tradeResult.autoCalculated
          ? Math.abs(tradeResult.pnlDollars).toFixed(2)
          : form.pnlInput,
        pnlMode: tradeResult.autoCalculated ? "dollar" : form.pnlMode,
        lotSize:
          displayLotSize === "—"
            ? formatLotSize(lotsForPnl) === "—"
              ? form.lotSize
              : formatLotSize(lotsForPnl)
            : displayLotSize,
        riskPercent: String(cappedRisk),
        accountBalanceAtEntry: currentBalance,
        accountId: form.accountId || defaultAccountId,
        checkedRuleIds: activeCheckedIds,
        ruleScore,
        createdAt: entryDateKey
          ? isoTimestampForDateKey(entryDateKey)
          : form.createdAt,
      });
      if (!initialData) {
        setForm({
          ...emptyTradeForm(),
          accountId: form.accountId || defaultAccountId,
          riskPercent: String(settings.defaultRiskPercent),
        });
        setManualPnl(false);
      }
    } catch {
      // Persist errors are shown by the journal/history views.
    } finally {
      setIsSaving(false);
    }
  };

  const formBody = (
    <>
      <h3 className={desk.title}>
        {entryDateKey
          ? `Log trade for ${formatCalendarDateLabel(entryDateKey)}`
          : "Log New Trade"}
      </h3>
      <p className={desk.subtitle}>
        Charts on the left, execution details and review on the right. P/L and
        lot size update from prices, size, and the live account balance.
      </p>

      {dailyLimitHit && (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Daily loss limit ({settings.dailyLossLimitPercent}%) is already tagged
          on this account. Size down or stand down before adding risk.
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-4">
          <p className={desk.label}>Multi-timeframe charts</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageDropzone
              compact
              label="Higher Time Frame"
              value={form.higherTimeFrame}
              onChange={(v) => update("higherTimeFrame", v)}
            />
            <ImageDropzone
              compact
              label="Middle Time Frame"
              value={form.middleTimeFrame}
              onChange={(v) => update("middleTimeFrame", v)}
            />
            <ImageDropzone
              compact
              label="Lower Time Frame"
              value={form.lowerTimeFrame}
              onChange={(v) => update("lowerTimeFrame", v)}
            />
            <ImageDropzone
              compact
              label="Entry"
              value={form.entry}
              onChange={(v) => update("entry", v)}
            />
            <ImageDropzone
              compact
              label="Before Chart (Setup)"
              value={form.beforeChart}
              onChange={(v) => update("beforeChart", v)}
            />
            <ImageDropzone
              compact
              label="After Chart (Result)"
              value={form.afterChart}
              onChange={(v) => update("afterChart", v)}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="trade-account" className={labelClass}>
                Trading account
              </label>
              <DeskSelect
                id="trade-account"
                value={form.accountId || defaultAccountId}
                onChange={(value) => update("accountId", value)}
                options={
                  accounts.length > 0
                    ? accounts.map((account) => ({
                        value: account.id,
                        label: account.name,
                      }))
                    : [
                        {
                          value: defaultAccountId || "main",
                          label: "Main",
                        },
                      ]
                }
              />
            </div>

            <div>
              <label htmlFor="pair" className={labelClass}>
                Pair / Ticker
              </label>
              <input
                id="pair"
                type="text"
                required
                placeholder="e.g. EURUSD, XAUUSD, BTCUSD"
                value={form.pair}
                onChange={(e) => update("pair", e.target.value.toUpperCase())}
                className={inputClass}
                list="known-assets"
              />
              <datalist id="known-assets">
                {KNOWN_SYMBOLS.map((symbol) => (
                  <option key={symbol} value={symbol} />
                ))}
              </datalist>
              {form.pair.trim() && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  {resolvedAsset.recognized ? (
                    <>
                      {resolvedAsset.spec.name} ·{" "}
                      {ASSET_CLASS_LABELS[resolvedAsset.spec.assetClass]}
                    </>
                  ) : (
                    "Unrecognized symbol — sizing as 1 unit per lot"
                  )}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="strategy" className={labelClass}>
                Strategy / Setup
              </label>
              <input
                id="strategy"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={form.strategy}
                onChange={(e) => update("strategy", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="direction" className={labelClass}>
                Direction
              </label>
              <DeskSelect
                id="direction"
                value={form.direction}
                onChange={(value) => update("direction", value)}
                options={[
                  { value: "Long", label: "Long" },
                  { value: "Short", label: "Short" },
                ]}
              />
            </div>

            <div>
              <label htmlFor="outcome" className={labelClass}>
                Result
              </label>
              <div className="flex rounded-lg border border-white/10 bg-[#12121a] p-1">
                {(
                  [
                    { id: "Win", label: "Win" },
                    { id: "Loss", label: "Loss" },
                    { id: "Breakeven", label: "BE" },
                  ] as const
                ).map((option) => {
                  const selected = form.outcome === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        update("outcome", option.id);
                        setManualPnl(false);
                      }}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        selected && option.id === "Win"
                          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                          : selected && option.id === "Loss"
                            ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/40"
                            : selected
                              ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40"
                              : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="lotSize" className={labelClass}>
                Lot size
              </label>
              <NumericDraftInput
                id="lotSize"
                placeholder={
                  calculatedLot != null ? formatLotSize(calculatedLot) : "e.g. 0.10"
                }
                value={
                  form.riskSizeMode === "fixed"
                    ? form.fixedLotSize
                    : form.lotSize
                }
                onValueChange={(next) => {
                  if (form.riskSizeMode === "fixed") {
                    update("fixedLotSize", next);
                    update("lotSize", next);
                    return;
                  }
                  update("lotSize", next);
                }}
                className={inputClass}
              />
              {calculatedLot != null && !form.lotSize.trim() && form.riskSizeMode !== "fixed" && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Using sizer lot {formatLotSize(calculatedLot)} for P/L
                </p>
              )}
            </div>

            <div>
              <label htmlFor="entryPrice" className={labelClass}>
                Entry Price
              </label>
              <NumericDraftInput
                id="entryPrice"
                placeholder="0.00"
                value={form.entryPrice}
                onValueChange={(next) => update("entryPrice", next)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="exitPrice" className={labelClass}>
                Exit Price
              </label>
              <NumericDraftInput
                id="exitPrice"
                placeholder="0.00"
                value={form.exitPrice}
                onValueChange={(next) => update("exitPrice", next)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="stopLoss" className={labelClass}>
                Stop Loss
              </label>
              <NumericDraftInput
                id="stopLoss"
                placeholder="0.00"
                value={form.stopLoss}
                onValueChange={(next) => update("stopLoss", next)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="takeProfit" className={labelClass}>
                Take Profit
              </label>
              <NumericDraftInput
                id="takeProfit"
                placeholder="0.00"
                value={form.takeProfit}
                onValueChange={(next) => update("takeProfit", next)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${desk.panel} border-indigo-400/15`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Profit / Loss</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Updates live from entry, exit, stop, lot size, and the
                    instrument contract. Type here to override.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualPnl((value) => !value)}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-300 hover:text-white"
                >
                  {manualPnl ? "Use auto" : "Manual"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <ToggleGroup<PnlMode>
                  value={pnlModeValue}
                  options={[
                    { id: "dollar", label: "$ Amount" },
                    { id: "percent", label: "% Percent" },
                  ]}
                  onChange={(value) => {
                    setManualPnl(true);
                    update("pnlMode", value);
                  }}
                />
                <NumericDraftInput
                  placeholder={
                    pnlModeValue === "dollar" ? "e.g. 250" : "e.g. 1.5"
                  }
                  value={pnlInputValue}
                  onValueChange={(next) => {
                    setManualPnl(true);
                    update("pnlInput", next);
                  }}
                  className={inputClass}
                />
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-[#0a0a12] px-3 py-2">
                <p className="text-xs text-zinc-400">
                  {manualPnl ? "Manual P/L" : "Resolved P/L"}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p
                    className={`font-mono text-lg ${
                      tradeResult.pnlDollars > 0
                        ? "text-emerald-400"
                        : tradeResult.pnlDollars < 0
                          ? "text-rose-400"
                          : "text-sky-300"
                    }`}
                  >
                    {formatPnlDollars(tradeResult.pnlDollars)}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${
                      tradeResult.outcome === "Win"
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40"
                        : tradeResult.outcome === "Loss"
                          ? "bg-rose-500/15 text-rose-300 ring-rose-400/40"
                          : "bg-sky-500/15 text-sky-300 ring-sky-400/40"
                    }`}
                  >
                    {tradeResult.outcome}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  New balance {formatBalance(currentBalance + tradeResult.pnlDollars)}
                  {lotsForPnl == null
                    ? " · add lot size to auto-calc"
                    : tradeResult.autoCalculated && exitSourceLabel
                      ? ` · from ${exitSourceLabel}${
                          needsQuoteConversion && quoteToUsd
                            ? ` · ${quoteCurrency}/USD ${quoteToUsd.toFixed(4)}`
                            : needsQuoteConversion
                              ? ` · ${quoteCurrency} converted to USD`
                              : ""
                        }`
                      : !tradeResult.autoCalculated && !exitForPnl
                        ? " · add exit, TP, or stop to auto-calc"
                        : ""}
                </p>
                {(sizedRiskUsd != null || rewardRiskRatio != null) && (
                  <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[11px] text-zinc-500">
                    {sizedRiskUsd != null && (
                      <p>Stop risk: {formatUsdCompact(sizedRiskUsd)}</p>
                    )}
                    {sizedRewardUsd != null && (
                      <p>Target reward: {formatUsdCompact(sizedRewardUsd)}</p>
                    )}
                    {rewardRiskRatio != null && (
                      <p>R:R {rewardRiskRatio.toFixed(2)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={`${desk.panel} border-indigo-400/15`}>
              <p className="text-sm font-semibold text-zinc-100">
                Automated position size
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Risk {cappedRisk}% of {formatBalance(currentBalance)}. Stop
                distance sets the exact lot size.
              </p>

              <div className="mt-4 space-y-3">
                <ToggleGroup<RiskSizeMode>
                  value={form.riskSizeMode}
                  options={[
                    { id: "fixed", label: "Fixed Size" },
                    { id: "percent", label: "Risk %" },
                  ]}
                  onChange={(value) => update("riskSizeMode", value)}
                />

                {form.riskSizeMode === "fixed" ? (
                  <NumericDraftInput
                    placeholder="Fixed lot / contracts"
                    value={form.fixedLotSize}
                    onValueChange={(next) => update("fixedLotSize", next)}
                    className={inputClass}
                  />
                ) : (
                  <NumericDraftInput
                    placeholder="Risk % of balance (e.g. 1)"
                    value={form.riskPercent}
                    onValueChange={(next) => update("riskPercent", next)}
                    className={inputClass}
                  />
                )}
                {riskCapped && (
                  <p className="text-[11px] text-amber-300">
                    Capped at the {settings.maxRiskPercent}% max-risk guardrail.
                  </p>
                )}

                <div className="rounded-lg border border-white/10 bg-[#0a0a12] px-3 py-2">
                  <p className="text-xs text-zinc-500">Calculated lot size</p>
                  <p className="mt-1 font-mono text-lg text-zinc-100">
                    {displayLotSize}
                  </p>
                  {positionRisk && form.pair.trim() && (
                    <div className="mt-2 space-y-1 text-xs text-zinc-500">
                      <p>
                        {formatPips(positionRisk.stopPips, positionRisk.spec)}{" "}
                        {positionRisk.spec.pipSize >= 1 ? "pts" : "pips"} stop
                      </p>
                      {sizedRiskUsd != null && (
                        <p>
                          Risk at this size: {formatUsdCompact(sizedRiskUsd)}
                          {sizedRewardUsd != null && (
                            <>
                              {" "}
                              · Reward: {formatUsdCompact(sizedRewardUsd)}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <RuleScorePanel
            items={checklistItems}
            score={ruleScore}
            onToggle={(id) =>
              setForm((prev) => {
                const source =
                  prev.checkedRuleIds.length > 0
                    ? prev.checkedRuleIds
                    : initialData?.checkedRuleIds ?? [];
                const checked = new Set(source);
                if (checked.has(id)) checked.delete(id);
                else checked.add(id);
                return { ...prev, checkedRuleIds: [...checked] };
              })
            }
          />

          <div className={`${desk.panel} border-indigo-400/15 space-y-5`}>
            <EmotionPicker
              label="Before entry"
              hint="How did you feel as you clicked into the trade?"
              value={form.emotionBefore}
              onChange={(value) => update("emotionBefore", value)}
            />
            <EmotionPicker
              label="After entry"
              hint="How did you feel once the trade was live or closed?"
              value={form.emotionAfter}
              onChange={(value) => update("emotionAfter", value)}
            />
          </div>

          <VoiceNoteField
            value={form.notes}
            onChange={(value) => update("notes", value)}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className={desk.btnGhost}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSaving} className={desk.btnPrimary}>
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </>
  );

  return (
    <form onSubmit={handleSubmit}>
      {embedded ? formBody : <DeskCard>{formBody}</DeskCard>}
    </form>
  );
});
