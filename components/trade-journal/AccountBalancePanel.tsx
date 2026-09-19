"use client";

import { DeskCard } from "@/components/ui/DeskCard";
import { formatBalance } from "@/lib/trades/account-balance";
import { desk } from "@/lib/ui/desk";

type AccountBalancePanelProps = {
  startingBalance: number;
  currentBalance: number;
  onStartingBalanceChange: (value: number) => void;
};

export function AccountBalancePanel({
  startingBalance,
  currentBalance,
  onStartingBalanceChange,
}: AccountBalancePanelProps) {
  const netPnl = currentBalance - startingBalance;

  return (
    <DeskCard>
      <h3 className={desk.title}>Account Balance</h3>
      <p className={desk.subtitle}>
        Starting balance and current equity update automatically from logged
        trade P/L.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="starting-balance" className={desk.label}>
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
            className={desk.input}
          />
        </div>

        <div className={`${desk.panel} border-indigo-400/20`}>
          <p className={desk.label}>Current Balance</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-indigo-200">
            {formatBalance(currentBalance)}
          </p>
        </div>

        <div
          className={`${desk.panel} ${
            netPnl >= 0 ? "border-emerald-400/25" : "border-rose-400/25"
          }`}
        >
          <p className={desk.label}>Net P/L</p>
          <p
            className={`mt-1 text-3xl font-extrabold tracking-tight ${
              netPnl > 0
                ? "text-emerald-300"
                : netPnl < 0
                  ? "text-rose-300"
                  : "text-sky-300"
            }`}
          >
            {netPnl >= 0 ? "+" : ""}
            {formatBalance(netPnl)}
          </p>
        </div>
      </div>
    </DeskCard>
  );
}
