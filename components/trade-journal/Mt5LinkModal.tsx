"use client";

import { validateMt5LinkInput } from "@/lib/mt5/credentials";
import { desk } from "@/lib/ui/desk";
import { Loader2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Mt5LinkModalProps = {
  accountName: string;
  defaultLogin?: string;
  defaultServer?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (input: {
    login: string;
    investorPassword: string;
    server: string;
  }) => Promise<void>;
};

export function Mt5LinkModal({
  accountName,
  defaultLogin = "",
  defaultServer = "",
  busy = false,
  onClose,
  onSubmit,
}: Mt5LinkModalProps) {
  const [login, setLogin] = useState(defaultLogin);
  const [investorPassword, setInvestorPassword] = useState("");
  const [server, setServer] = useState(defaultServer);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  const parsed = validateMt5LinkInput({ login, investorPassword, server });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.ok || busy) {
      setError(parsed.ok ? null : parsed.error);
      return;
    }
    setError(null);
    try {
      await onSubmit({
        login: parsed.login,
        investorPassword: parsed.investorPassword,
        server: parsed.server,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not link that MT5 account."
      );
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close MT5 link"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        disabled={busy}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mt5-link-title"
        className="fixed inset-x-3 top-[max(12vh,env(safe-area-inset-top))] z-50 mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-indigo-400/25 bg-[#0c0c16] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-indigo-400/15 px-5 py-4">
          <div>
            <h3 id="mt5-link-title" className="text-lg font-semibold text-zinc-100">
              Link MetaTrader 5
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Connect {accountName} with your investor login. Edge Log validates
              the account and maps live trades into this journal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="mt5-modal-login" className={desk.label}>
              MT5 account number
            </label>
            <input
              id="mt5-modal-login"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={32}
              placeholder="12345678"
              value={login}
              onChange={(e) => setLogin(e.target.value.replace(/[^\d]/g, ""))}
              className={desk.input}
            />
          </div>

          <div>
            <label htmlFor="mt5-modal-password" className={desk.label}>
              Investor password
            </label>
            <input
              id="mt5-modal-password"
              type="password"
              autoComplete="off"
              maxLength={64}
              placeholder="Read-only password"
              value={investorPassword}
              onChange={(e) => setInvestorPassword(e.target.value)}
              className={desk.input}
            />
          </div>

          <div>
            <label htmlFor="mt5-modal-server" className={desk.label}>
              Broker server
            </label>
            <input
              id="mt5-modal-server"
              type="text"
              autoComplete="off"
              maxLength={64}
              placeholder="ICMarkets-Demo"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className={desk.input}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !parsed.ok}
            className={`${desk.btnPrimary} w-full`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Connecting…" : "Connect MT5"}
          </button>
        </form>
      </div>
    </>
  );
}
