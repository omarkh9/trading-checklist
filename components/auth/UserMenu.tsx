"use client";

import { signOut } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthUserInfo = {
  label: string;
  initial: string;
};

type UserMenuProps = {
  variant?: "header" | "sidebar";
};

export function UserMenu({ variant = "header" }: UserMenuProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserInfo | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (cancelled || !authUser) {
        if (!cancelled) setUser(null);
        return;
      }

      const label = authUser.email ?? "Trader";
      if (!cancelled) {
        setUser({
          label,
          initial: label.slice(0, 1).toUpperCase(),
        });
      }
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  if (!user) {
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

  if (variant === "sidebar") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-[0_0_14px_rgba(99,102,241,0.28)] ring-1 ring-indigo-300/25">
          {user.initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">{user.label}</p>
          <p className="text-[11px] text-zinc-500">Signed in</p>
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
        <p className="truncate text-sm font-medium text-zinc-300">{user.label}</p>
        <p className="text-xs text-zinc-500">Signed in</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-[0_0_14px_rgba(99,102,241,0.28)] ring-1 ring-indigo-300/25">
        {user.initial}
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
