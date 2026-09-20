"use client";

import { useOwner } from "@/components/auth/useOwner";
import { getRedirectUrl, signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";

type UserMenuProps = {
  variant?: "header" | "sidebar";
};

export function UserMenu({ variant = "header" }: UserMenuProps) {
  const { loading, email, isOwner } = useOwner();

  const handleSignOut = async () => {
    await signOut();
    window.location.assign(getRedirectUrl("/login"));
  };

  if (loading || !email) {
    return (
      <div
        className={
          variant === "sidebar"
            ? "h-12 animate-pulse rounded-xl bg-white/[0.03]"
            : "h-9 w-9 animate-pulse rounded-full bg-white/5"
        }
      />
    );
  }

  const initial = email.slice(0, 1).toUpperCase();
  const roleLabel = isOwner ? "Owner" : "Signed in";

  if (variant === "sidebar") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-[0_0_14px_rgba(99,102,241,0.28)] ring-1 ring-indigo-300/25">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">{email}</p>
          <p
            className={`text-[11px] ${
              isOwner ? "font-medium text-indigo-300" : "text-zinc-500"
            }`}
          >
            {roleLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-300"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-zinc-300">{email}</p>
        <p
          className={`text-xs ${
            isOwner ? "font-medium text-indigo-300" : "text-zinc-500"
          }`}
        >
          {roleLabel}
        </p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-[0_0_14px_rgba(99,102,241,0.28)] ring-1 ring-indigo-300/25">
        {initial}
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
