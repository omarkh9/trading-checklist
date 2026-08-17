"use client";

import { ImageDropzone } from "@/components/trade-journal/ImageDropzone";
import {
  emptyTradeForm,
  type Direction,
  type Outcome,
  type TradeFormData,
} from "@/lib/types/trade";
import { Save } from "lucide-react";
import { useState } from "react";

type TradeFormProps = {
  onSubmit: (data: TradeFormData) => void;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-400";

export function TradeForm({ onSubmit }: TradeFormProps) {
  const [form, setForm] = useState<TradeFormData>(emptyTradeForm());

  const update = <K extends keyof TradeFormData>(
    key: K,
    value: TradeFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pair.trim()) return;

    onSubmit(form);
    setForm(emptyTradeForm());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface-raised p-6"
    >
      <h3 className="text-lg font-semibold text-zinc-100">Log New Trade</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Capture setup, execution, and outcome in one place.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="pair" className={labelClass}>
            Pair / Ticker
          </label>
          <input
            id="pair"
            type="text"
            required
            placeholder="e.g. ES, BTCUSD"
            value={form.pair}
            onChange={(e) => update("pair", e.target.value.toUpperCase())}
            className={inputClass}
          />
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

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Save className="h-4 w-4" />
          Save Trade
        </button>
      </div>
    </form>
  );
}
