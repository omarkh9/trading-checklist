"use client";

import { formatBalance } from "@/lib/trades/account-balance";
import {
  ASSET_CLASS_LABELS,
  listKnownSymbols,
  resolveAsset,
} from "@/lib/trades/assets";
import {
  calculatePositionSize,
  calculateStopLossPrice,
  formatLotSize,
  formatPrice,
} from "@/lib/trades/lot-size";
import { parseNumericInput } from "@/lib/trades/pnl";
import type { Direction } from "@/lib/types/trade";
import { desk } from "@/lib/ui/desk";
import { useMemo, useState } from "react";

const KNOWN_SYMBOLS = listKnownSymbols();

type PositionSizerProps = {
  accountBalance: number;
  defaultRiskPercent?: number;
  maxRiskPercent?: number;
};

export function PositionSizer({
  accountBalance,
  defaultRiskPercent = 1,
  maxRiskPercent = 2,
}: PositionSizerProps) {
  const [pair, setPair] = useState("EURUSD");
  const [direction, setDirection] = useState<Direction>("Long");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [riskPercent, setRiskPercent] = useState(String(defaultRiskPercent));

  const cappedRisk = useMemo(() => {
    const raw = parseNumericInput(riskPercent) ?? defaultRiskPercent;
    return Math.min(Math.max(raw, 0), maxRiskPercent);
  }, [defaultRiskPercent, maxRiskPercent, riskPercent]);

  const sized = useMemo(
    () =>
      calculatePositionSize({
        pair,
        riskSizeMode: "percent",
        riskPercent: String(cappedRisk),
        fixedLotSize: "",
        entryPrice,
        stopLoss,
        accountBalance,
      }),
    [accountBalance, cappedRisk, entryPrice, pair, stopLoss]
  );

  const suggestedStop = useMemo(() => {
    if (parseNumericInput(stopLoss) != null) return parseNumericInput(stopLoss);
    return calculateStopLossPrice({
      pair,
      direction,
      entryPrice,
      lots: 0.1,
      accountBalance,
      riskPercent: String(cappedRisk),
    });
  }, [
    accountBalance,
    cappedRisk,
    direction,
    entryPrice,
    pair,
    stopLoss,
  ]);

  const asset = resolveAsset(pair);
  const riskUsd = accountBalance * (cappedRisk / 100);
  const overCap =
    (parseNumericInput(riskPercent) ?? 0) > maxRiskPercent + 0.0001;

  return (
    <div className={`${desk.panel} border-indigo-400/15`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            Risk & position sizer
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Lot size and stop distance from live balance (
            {formatBalance(accountBalance)}) and your risk percentage.
          </p>
        </div>
        <p className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-200">
          {cappedRisk.toFixed(2)}% · {formatBalance(riskUsd)} risk
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={desk.label} htmlFor="sizer-pair">
            Pair
          </label>
          <input
            id="sizer-pair"
            value={pair}
            list="sizer-assets"
            onChange={(event) => setPair(event.target.value.toUpperCase())}
            className={desk.input}
          />
          <datalist id="sizer-assets">
            {KNOWN_SYMBOLS.map((symbol) => (
              <option key={symbol} value={symbol} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-zinc-500">
            {asset.recognized
              ? `${asset.spec.name} · ${ASSET_CLASS_LABELS[asset.spec.assetClass]}`
              : "Unrecognized symbol"}
          </p>
        </div>
        <div>
          <label className={desk.label} htmlFor="sizer-direction">
            Direction
          </label>
          <select
            id="sizer-direction"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as Direction)
            }
            className={desk.input}
          >
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
        </div>
        <div>
          <label className={desk.label} htmlFor="sizer-risk">
            Risk %
          </label>
          <input
            id="sizer-risk"
            type="text"
            inputMode="decimal"
            value={riskPercent}
            onChange={(event) => setRiskPercent(event.target.value)}
            className={desk.input}
          />
          {overCap && (
            <p className="mt-1 text-[11px] text-amber-300">
              Capped at your {maxRiskPercent}% max-risk guardrail.
            </p>
          )}
        </div>
        <div>
          <label className={desk.label} htmlFor="sizer-entry">
            Entry
          </label>
          <input
            id="sizer-entry"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={entryPrice}
            onChange={(event) => setEntryPrice(event.target.value)}
            className={desk.input}
          />
        </div>
        <div>
          <label className={desk.label} htmlFor="sizer-stop">
            Stop loss
          </label>
          <input
            id="sizer-stop"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={stopLoss}
            onChange={(event) => setStopLoss(event.target.value)}
            className={desk.input}
          />
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0a0a12] px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Suggested SL
          </p>
          <p className="mt-1 font-mono text-lg text-zinc-100">
            {formatPrice(suggestedStop)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Lot size
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-indigo-200">
            {formatLotSize(sized?.lots ?? null)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Stop distance
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-100">
            {sized ? `${sized.stopPips.toFixed(1)} pips` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Dollar risk
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-100">
            {sized ? formatBalance(sized.riskAmount) : formatBalance(riskUsd)}
          </p>
        </div>
      </div>
    </div>
  );
}
