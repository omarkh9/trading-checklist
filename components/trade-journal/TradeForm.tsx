"use client";

import { ImageDropzone } from "@/components/trade-journal/ImageDropzone";
import { formatBalance } from "@/lib/trades/account-balance";
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
import { calculateLotSize, formatLotSize } from "@/lib/trades/lot-size";
import { formatPnlDollars, parseNumericInput, resolvePnlDollars } from "@/lib/trades/pnl";
import {
  emptyTradeForm,
  type Direction,
  type Outcome,
  type PnlMode,
  type RiskSizeMode,
  type TradeFormData,
} from "@/lib/types/trade";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TradeFormProps = {
  currentBalance: number;
  onSubmit: (data: TradeFormData) => void | Promise<void>;
  initialData?: TradeFormData;
  onCancel?: () => void;
  submitLabel?: string;
  embedded?: boolean;
};

const KNOWN_SYMBOLS = listKnownSymbols();

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-400";

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
    <div className="flex rounded-lg border border-border bg-surface-overlay p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.id
              ? "bg-accent text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TradeForm({
  currentBalance,
  onSubmit,
  initialData,
  onCancel,
  submitLabel = "Save Trade",
  embedded = false,
}: TradeFormProps) {
  const [form, setForm] = useState<TradeFormData>(
    initialData ?? emptyTradeForm()
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(initialData ?? emptyTradeForm());
  }, [initialData]);

  const update = <K extends keyof TradeFormData>(
    key: K,
    value: TradeFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const resolvedPnl = useMemo(
    () =>
      resolvePnlDollars(
        form.outcome,
        form.pnlMode,
        form.pnlInput,
        currentBalance
      ),
    [form.outcome, form.pnlMode, form.pnlInput, currentBalance]
  );

  const calculatedLot = useMemo(
    () =>
      calculateLotSize({
        pair: form.pair,
        riskSizeMode: form.riskSizeMode,
        riskPercent: form.riskPercent,
        fixedLotSize: form.fixedLotSize,
        entryPrice: form.entryPrice,
        stopLoss: form.stopLoss,
        accountBalance: currentBalance,
      }),
    [
      form.pair,
      form.riskSizeMode,
      form.riskPercent,
      form.fixedLotSize,
      form.entryPrice,
      form.stopLoss,
      currentBalance,
    ]
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
    });
  }, [form.pair, form.entryPrice, form.stopLoss, form.takeProfit]);

  const sizedRiskUsd =
    calculatedLot != null && positionRisk
      ? calculatedLot * positionRisk.riskPerLotUsd
      : null;
  const sizedRewardUsd =
    calculatedLot != null && positionRisk?.rewardPerLotUsd != null
      ? calculatedLot * positionRisk.rewardPerLotUsd
      : null;

  const displayLotSize =
    form.riskSizeMode === "fixed"
      ? form.fixedLotSize || "—"
      : formatLotSize(calculatedLot);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pair.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSubmit({
        ...form,
        pnlDollars: resolvedPnl,
        lotSize: displayLotSize === "—" ? "" : displayLotSize,
        accountBalanceAtEntry: currentBalance,
      });
      if (!initialData) {
        setForm(emptyTradeForm());
      }
    } catch {
      // Persist errors are shown by the journal/history views.
    } finally {
      setIsSaving(false);
    }
  };

  const showPnlFields = form.outcome !== "Breakeven";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        embedded
          ? "p-0"
          : "rounded-xl border border-border bg-surface-raised p-6"
      }
    >
      <h3 className="text-lg font-semibold text-zinc-100">Log New Trade</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Attach chart screenshots for each timeframe, then capture execution,
        risk, and outcome details below.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ImageDropzone
          label="Higher Time Frame"
          value={form.higherTimeFrame}
          onChange={(v) => update("higherTimeFrame", v)}
        />
        <ImageDropzone
          label="Middle Time Frame"
          value={form.middleTimeFrame}
          onChange={(v) => update("middleTimeFrame", v)}
        />
        <ImageDropzone
          label="Lower Time Frame"
          value={form.lowerTimeFrame}
          onChange={(v) => update("lowerTimeFrame", v)}
        />
        <ImageDropzone
          label="Entry"
          value={form.entry}
          onChange={(v) => update("entry", v)}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  {ASSET_CLASS_LABELS[resolvedAsset.spec.assetClass]} · 1.00 lot
                  ={" "}
                  {resolvedAsset.spec.contractSize.toLocaleString("en-US")}{" "}
                  {resolvedAsset.spec.contractUnit}
                </>
              ) : (
                "Unrecognized symbol — sizing as 1 unit per lot"
              )}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="direction" className={labelClass}>
            Direction
          </label>
          <select
            id="direction"
            value={form.direction}
            onChange={(e) => update("direction", e.target.value as Direction)}
            className={inputClass}
          >
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
        </div>

        <div>
          <label htmlFor="outcome" className={labelClass}>
            Outcome
          </label>
          <select
            id="outcome"
            value={form.outcome}
            onChange={(e) => update("outcome", e.target.value as Outcome)}
            className={inputClass}
          >
            <option value="Win">Win</option>
            <option value="Loss">Loss</option>
            <option value="Breakeven">Breakeven</option>
          </select>
        </div>

        <div>
          <label htmlFor="entryPrice" className={labelClass}>
            Entry Price
          </label>
          <input
            id="entryPrice"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.entryPrice}
            onChange={(e) => update("entryPrice", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="stopLoss" className={labelClass}>
            Stop Loss
          </label>
          <input
            id="stopLoss"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.stopLoss}
            onChange={(e) => update("stopLoss", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="takeProfit" className={labelClass}>
            Take Profit
          </label>
          <input
            id="takeProfit"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.takeProfit}
            onChange={(e) => update("takeProfit", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-overlay/40 p-4">
          <p className="text-sm font-medium text-zinc-200">Profit / Loss</p>
          <p className="mt-1 text-xs text-zinc-500">
            Enter the result as dollars or as a percent of your current balance (
            {formatBalance(currentBalance)}).
          </p>

          {showPnlFields ? (
            <div className="mt-4 space-y-3">
              <ToggleGroup<PnlMode>
                value={form.pnlMode}
                options={[
                  { id: "dollar", label: "$ Amount" },
                  { id: "percent", label: "% Percent" },
                ]}
                onChange={(value) => update("pnlMode", value)}
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder={
                  form.pnlMode === "dollar" ? "e.g. 250" : "e.g. 1.5"
                }
                value={form.pnlInput}
                onChange={(e) => update("pnlInput", e.target.value)}
                className={inputClass}
              />
              <p className="text-sm text-zinc-400">
                Resolved P/L:{" "}
                <span
                  className={
                    resolvedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  {formatPnlDollars(resolvedPnl)}
                </span>
                {form.pnlMode === "percent" && form.pnlInput.trim() && (
                  <span className="text-zinc-500">
                    {" "}
                    ({form.pnlInput}% of balance)
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              Break-even trades apply $0 P/L to your account.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-overlay/40 p-4">
          <p className="text-sm font-medium text-zinc-200">Lot Size</p>
          <p className="mt-1 text-xs text-zinc-500">
            Use a fixed lot size or risk a percentage of balance based on entry
            and stop distance.
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
              <input
                type="text"
                inputMode="decimal"
                placeholder="Fixed lot / contracts"
                value={form.fixedLotSize}
                onChange={(e) => update("fixedLotSize", e.target.value)}
                className={inputClass}
              />
            ) : (
              <input
                type="text"
                inputMode="decimal"
                placeholder="Risk % of balance (e.g. 1)"
                value={form.riskPercent}
                onChange={(e) => update("riskPercent", e.target.value)}
                className={inputClass}
              />
            )}

            <div className="rounded-lg bg-surface-overlay px-3 py-2">
              <p className="text-xs text-zinc-500">Calculated lot size</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">
                {displayLotSize}
              </p>
              {positionRisk && form.pair.trim() && (
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <p>
                    {formatPips(positionRisk.stopPips, positionRisk.spec)}{" "}
                    {positionRisk.spec.pipSize >= 1 ? "pts" : "pips"} stop ·{" "}
                    {formatUsdCompact(positionRisk.pipValuePerLotUsd)}
                    /{positionRisk.spec.pipSize >= 1 ? "pt" : "pip"}/lot
                    {positionRisk.conversionAccuracy === "approximate"
                      ? " (approx. FX conversion)"
                      : ""}
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
                  <p>
                    Micro lot {positionRisk.spec.microLot} · Mini{" "}
                    {positionRisk.spec.miniLot} · Step{" "}
                    {positionRisk.spec.lotStep}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Setup rationale, emotions, lessons learned..."
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ImageDropzone
          label="Before Chart (Setup)"
          value={form.beforeChart}
          onChange={(v) => update("beforeChart", v)}
        />
        <ImageDropzone
          label="After Chart (Result)"
          value={form.afterChart}
          onChange={(v) => update("afterChart", v)}
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-surface-overlay"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
