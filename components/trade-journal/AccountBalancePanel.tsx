"use client";

import { useAccounts } from "@/components/accounts/AccountProvider";
import { DeskCard } from "@/components/ui/DeskCard";
import { generateMt5WebhookToken, isUsableMt5Token } from "@/lib/mt5/token";
import { getMt5WebhookUrl } from "@/lib/mt5/webhook";
import { formatBalance } from "@/lib/trades/account-balance";
import {
  MAX_TRADING_ACCOUNTS,
  nextAccountName,
} from "@/lib/types/account";
import { desk } from "@/lib/ui/desk";
import { parseNumericInput } from "@/lib/trades/pnl";
import { Check, Copy, KeyRound, Plus, Trash2, Unlink } from "lucide-react";
import { memo, useEffect, useState } from "react";

function toBalanceDraft(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function normalizeBalanceDraft(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const dot = cleaned.indexOf(".");
  const wholeRaw = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const fraction = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/\./g, "");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");

  if (dot === -1) return whole;
  return `${whole || "0"}.${fraction}`;
}

function parseBalanceDraft(value: string) {
  if (!value.trim()) return 0;
  const parsed = parseNumericInput(value);
  return parsed != null && parsed >= 0 ? parsed : 0;
}

function formatSyncedAt(value: string | null) {
  if (!value) return "Waiting for first snapshot";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waiting for first snapshot";
  return date.toLocaleString();
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

type AccountBalancePanelProps = {
  currentBalance: number;
};

export const AccountBalancePanel = memo(function AccountBalancePanel({
  currentBalance,
}: AccountBalancePanelProps) {
  const {
    accounts,
    activeAccount,
    setActiveAccountId,
    createAccount,
    renameAccount,
    updateStartingBalance,
    updateMt5Link,
    deleteAccount,
  } = useAccounts();

  const [name, setName] = useState(activeAccount?.name ?? "");
  const [startingBalanceDraft, setStartingBalanceDraft] = useState(
    toBalanceDraft(activeAccount?.startingBalance ?? 0)
  );
  const [mt5Login, setMt5Login] = useState(activeAccount?.mt5Login ?? "");
  const [mt5Server, setMt5Server] = useState(activeAccount?.mt5Server ?? "");
  const [mt5Token, setMt5Token] = useState("");
  const [copied, setCopied] = useState<"url" | "token" | null>(null);
  const [mt5Busy, setMt5Busy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState(10_000);
  const [isCreating, setIsCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(activeAccount?.name ?? "");
    setStartingBalanceDraft(toBalanceDraft(activeAccount?.startingBalance ?? 0));
    setMt5Login(activeAccount?.mt5Login ?? "");
    setMt5Server(activeAccount?.mt5Server ?? "");
    setMt5Token("");
  }, [
    activeAccount?.id,
    activeAccount?.name,
    activeAccount?.startingBalance,
    activeAccount?.mt5Login,
    activeAccount?.mt5Server,
  ]);

  const startingBalance = parseBalanceDraft(startingBalanceDraft);
  const netPnl = currentBalance - startingBalance;
  const canAdd = accounts.length < MAX_TRADING_ACCOUNTS;
  const webhookUrl = getMt5WebhookUrl();
  const mt5Linked = Boolean(activeAccount?.mt5TokenSet);
  const mt5Ready =
    mt5Login.trim().length > 0 &&
    mt5Server.trim().length > 0 &&
    (mt5Linked || isUsableMt5Token(mt5Token));

  const persistName = async () => {
    if (!activeAccount) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === activeAccount.name) {
      setName(activeAccount.name);
      return;
    }
    try {
      await renameAccount(activeAccount.id, trimmed);
    } catch {
      setName(activeAccount.name);
    }
  };

  const persistStartingBalance = async () => {
    if (!activeAccount) return;
    const next = parseBalanceDraft(startingBalanceDraft);
    setStartingBalanceDraft(toBalanceDraft(next));
    if (next === activeAccount.startingBalance) return;
    try {
      await updateStartingBalance(activeAccount.id, next);
    } catch {
      setStartingBalanceDraft(toBalanceDraft(activeAccount.startingBalance));
    }
  };

  const persistMt5Link = async () => {
    if (!activeAccount || !mt5Ready || mt5Busy) return;
    setMt5Busy(true);
    try {
      await updateMt5Link(activeAccount.id, {
        mt5Login,
        mt5Server,
        ...(mt5Token.trim() ? { mt5WebhookToken: mt5Token.trim() } : {}),
      });
      setMt5Token("");
    } catch {
      // Surface via AccountProvider error on the journal.
    } finally {
      setMt5Busy(false);
    }
  };

  const unlinkMt5 = async () => {
    if (!activeAccount || !mt5Linked || mt5Busy) return;
    const confirmed = window.confirm(
      "Unlink this MT5 account? Incoming balance updates will stop until you save a new token."
    );
    if (!confirmed) return;
    setMt5Busy(true);
    try {
      await updateMt5Link(activeAccount.id, { unlinkMt5: true });
      setMt5Login("");
      setMt5Server("");
      setMt5Token("");
    } catch {
      // Surface via AccountProvider error on the journal.
    } finally {
      setMt5Busy(false);
    }
  };

  const handleCopy = async (kind: "url" | "token", value: string) => {
    if (!value) return;
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(kind);
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600);
  };

  const handleCreate = async () => {
    if (!canAdd || busy) return;
    setBusy(true);
    try {
      await createAccount({
        name: newName.trim() || nextAccountName(accounts),
        startingBalance:
          Number.isFinite(newBalance) && newBalance >= 0 ? newBalance : 0,
      });
      setNewName("");
      setNewBalance(10_000);
      setIsCreating(false);
    } catch {
      // Surface via AccountProvider error on the journal.
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, accountName: string) => {
    if (accounts.length <= 1 || busy) return;
    const confirmed = window.confirm(
      `Delete ${accountName} and its trades? This cannot be undone.`
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteAccount(id);
    } catch {
      // Surface via AccountProvider error on the journal.
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskCard>
      <h3 className={desk.title}>Account Balance</h3>
      <p className={desk.subtitle}>
        Each trading account keeps its own starting balance, trades, and
        journal. Switch accounts anytime — up to {MAX_TRADING_ACCOUNTS}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="account-name" className={desk.label}>
            Account name
          </label>
          <input
            id="account-name"
            type="text"
            maxLength={48}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void persistName()}
            className={desk.input}
          />
        </div>

        <div>
          <label htmlFor="starting-balance" className={desk.label}>
            Starting Balance
          </label>
          <input
            id="starting-balance"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={startingBalanceDraft}
            onChange={(e) =>
              setStartingBalanceDraft(normalizeBalanceDraft(e.target.value))
            }
            onBlur={() => void persistStartingBalance()}
            className={desk.input}
          />
        </div>

        <div className={`${desk.panel} border-indigo-400/20`}>
          <p className={desk.label}>Current Balance</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-indigo-200">
            {formatBalance(currentBalance)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Journal start + P/L</p>
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

      <div className="mt-6">
        <div className={`${desk.panel} border-indigo-400/20`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={desk.label}>MetaTrader 5</p>
              <p className="mt-1 text-sm text-zinc-400">
                Link this journal account to an MT5 login. Your EA posts live
                balance and equity to the webhook below.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                mt5Linked
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/5 text-zinc-500"
              }`}
            >
              {mt5Linked ? "Linked" : "Not linked"}
            </span>
          </div>

          {mt5Linked && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className={desk.label}>MT5 Balance</p>
                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {activeAccount?.mt5Balance != null
                    ? formatBalance(activeAccount.mt5Balance)
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className={desk.label}>MT5 Equity</p>
                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {activeAccount?.mt5Equity != null
                    ? formatBalance(activeAccount.mt5Equity)
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className={desk.label}>Last sync</p>
                <p className="mt-1 text-sm text-zinc-300">
                  {formatSyncedAt(activeAccount?.mt5SyncedAt ?? null)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mt5-login" className={desk.label}>
                MT5 account number
              </label>
              <input
                id="mt5-login"
                type="text"
                inputMode="numeric"
                maxLength={32}
                placeholder="12345678"
                value={mt5Login}
                onChange={(e) => setMt5Login(e.target.value.replace(/[^\d]/g, ""))}
                className={desk.input}
              />
            </div>
            <div>
              <label htmlFor="mt5-server" className={desk.label}>
                Broker server
              </label>
              <input
                id="mt5-server"
                type="text"
                maxLength={64}
                placeholder="ICMarkets-Demo"
                value={mt5Server}
                onChange={(e) => setMt5Server(e.target.value)}
                className={desk.input}
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="mt5-webhook" className={desk.label}>
              Webhook endpoint
            </label>
            <div className="flex gap-2">
              <input
                id="mt5-webhook"
                type="text"
                readOnly
                value={webhookUrl}
                className={`${desk.input} font-mono text-xs`}
              />
              <button
                type="button"
                onClick={() => void handleCopy("url", webhookUrl)}
                className={desk.btnGhost}
              >
                {copied === "url" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === "url" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="mt5-token" className={desk.label}>
              API token
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="mt5-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  mt5Linked
                    ? "Token saved — paste a new one to rotate"
                    : "Generate or paste a secret token"
                }
                value={mt5Token}
                onChange={(e) => setMt5Token(e.target.value)}
                className={`${desk.input} font-mono`}
              />
              <button
                type="button"
                onClick={() => setMt5Token(generateMt5WebhookToken())}
                className={desk.btnGhost}
              >
                <KeyRound className="h-4 w-4" />
                Generate
              </button>
              <button
                type="button"
                disabled={!mt5Token}
                onClick={() => void handleCopy("token", mt5Token)}
                className={desk.btnGhost}
              >
                {copied === "token" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === "token" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              POST JSON <code className="text-zinc-400">balance</code> and{" "}
              <code className="text-zinc-400">equity</code> with{" "}
              <code className="text-zinc-400">Authorization: Bearer &lt;token&gt;</code>.
              Edge Log stores a hash of the token, not the raw secret.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!mt5Ready || mt5Busy}
              onClick={() => void persistMt5Link()}
              className={desk.btnPrimary}
            >
              {mt5Linked ? "Save MT5 link" : "Link MT5 account"}
            </button>
            {mt5Linked && (
              <button
                type="button"
                disabled={mt5Busy}
                onClick={() => void unlinkMt5()}
                className={desk.btnGhost}
              >
                <Unlink className="h-4 w-4" />
                Unlink
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className={desk.label}>
            Trading accounts ({accounts.length}/{MAX_TRADING_ACCOUNTS})
          </p>
          {canAdd && !isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add account
            </button>
          )}
        </div>

        <div className="space-y-2">
          {accounts.map((account) => {
            const selected = account.id === activeAccount?.id;
            return (
              <div
                key={account.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  selected
                    ? "border-indigo-400/35 bg-indigo-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveAccountId(account.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {account.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Start {formatBalance(account.startingBalance)}
                    {account.mt5TokenSet
                      ? account.mt5Balance != null
                        ? ` · MT5 ${formatBalance(account.mt5Balance)}`
                        : " · MT5 linked"
                      : ""}
                    {selected ? " · Active journal" : ""}
                  </p>
                </button>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Delete ${account.name}`}
                    disabled={busy}
                    onClick={() => void handleDelete(account.id, account.name)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {isCreating && canAdd && (
          <div className="mt-3 grid gap-3 rounded-lg border border-indigo-400/20 bg-indigo-500/5 p-3 sm:grid-cols-[1fr_8rem_auto]">
            <input
              type="text"
              maxLength={48}
              placeholder={nextAccountName(accounts)}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={desk.input}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={newBalance}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                setNewBalance(Number.isFinite(next) && next >= 0 ? next : 0);
              }}
              className={desk.input}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreate()}
                className={desk.btnPrimary}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className={desk.btnGhost}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DeskCard>
  );
});
