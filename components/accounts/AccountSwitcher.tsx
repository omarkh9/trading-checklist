"use client";

import { useAccountSwitcher } from "@/components/accounts/AccountProvider";
import { MAX_TRADING_ACCOUNTS } from "@/lib/types/account";
import { ChevronDown, Wallet } from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

type AccountSwitcherProps = {
  variant?: "header" | "sidebar";
};

export const AccountSwitcher = memo(function AccountSwitcher({
  variant = "header",
}: AccountSwitcherProps) {
  const { accounts, activeId, isLoaded, setActiveAccountId } =
    useAccountSwitcher();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const activeAccount = accounts.find((account) => account.id === activeId);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(undefined);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = variant === "sidebar" ? rect.width : 256;
      const gap = 4;
      const padding = 8;
      const left = Math.min(
        Math.max(padding, rect.right - width),
        window.innerWidth - width - padding
      );

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + gap,
        left,
        width,
        zIndex: 70,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (!isLoaded) {
    return (
      <div
        className={
          variant === "sidebar"
            ? "h-12 animate-pulse rounded-xl bg-white/[0.03]"
            : "h-10 w-36 animate-pulse rounded-lg bg-white/5"
        }
      />
    );
  }

  if (!activeAccount) return null;

  const menu = open ? (
    <ul
      ref={menuRef}
      role="listbox"
      style={menuStyle}
      className="max-h-80 overflow-y-auto rounded-lg border border-indigo-400/20 bg-[#12121a] py-1 text-zinc-100 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
    >
      {accounts.map((account) => {
        const selected = account.id === activeAccount.id;
        return (
          <li key={account.id} role="option" aria-selected={selected}>
            <button
              type="button"
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? "bg-indigo-500/20 text-indigo-200"
                  : "text-zinc-200 hover:bg-white/[0.06] hover:text-zinc-50"
              }`}
              onClick={() => {
                setActiveAccountId(account.id);
                setOpen(false);
              }}
            >
              <span className="truncate">{account.name}</span>
              {selected && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300">
                  Active
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch trading account"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={
          variant === "sidebar"
            ? "flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left transition-all duration-300 hover:border-indigo-400/30 hover:bg-indigo-500/10"
            : "flex max-w-[220px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10"
        }
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/25">
          <Wallet className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">
            {activeAccount.name}
          </span>
          <span className="block text-[11px] text-zinc-500">
            {accounts.length}/{MAX_TRADING_ACCOUNTS} accounts
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {menu && menuStyle ? createPortal(menu, document.body) : null}
    </div>
  );
});
