"use client";

import { formatBalance } from "@/lib/trades/account-balance";

type AccountBalancePanelProps = {
  startingBalance: number;
  currentBalance: number;
  onStartingBalanceChange: (value: number) => void;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

export function AccountBalancePanel({
  startingBalance,
  currentBalance,
  onStartingBalanceChange,
}: AccountBalancePanelProps) {
  const netPnl = currentBalance - startingBalance;

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-6">
      <h3 className="text-lg font-semibold text-zinc-100">Account Balance</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Starting balance and current equity update automatically from logged
        trade P/L.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="starting-balance" className="mb-1.5 block text-sm font-medium text-zinc-400">
            Starting Balance
          </label>
          <input
            id="starting-balance"
            type="number"
            min={0}
            step="0.01"
            value={Number.isFinite(startingBalance) ? startingBalance : 0}
            onChange={(e) => {
              const next = parseFloat(e.target.value);
              onStartingBalanceChange(
                Number.isFinite(next) && next >= 0 ? next : 0
              );
            }}
            className={inputClass}
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-overlay/50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Current Balance
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-100">
            {formatBalance(currentBalance)}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-overlay/50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Net P/L
          </p>
          <p
            className={`mt-2 text-2xl font-bold ${
              netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {netPnl >= 0 ? "+" : ""}
            {formatBalance(netPnl)}
          </p>
        </div>
      </div>
    </div>
  );
}
