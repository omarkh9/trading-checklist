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

export function UserMenu() {
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
      <div className="h-9 w-9 animate-pulse rounded-full bg-surface-overlay" />
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-zinc-300">{user.label}</p>
        <p className="text-xs text-zinc-500">Signed in</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white ring-2 ring-surface-overlay">
        {user.initial}
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-zinc-400 transition-colors hover:bg-surface-overlay hover:text-zinc-100"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
