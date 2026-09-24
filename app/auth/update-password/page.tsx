"use client";

import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import {
  capturePasswordRecovery,
  markPasswordRecovery,
} from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/client";
import { Activity } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function UpdatePasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    capturePasswordRecovery
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const markReady = (hasUser: boolean) => {
      if (cancelled) return;
      if (hasUser) markPasswordRecovery();
      setHasSession(hasUser);
      setReady(true);
    };

    if (capturePasswordRecovery()) {
      setIsPasswordRecovery(true);
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsPasswordRecovery(true);
        markReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecovery();
        setIsPasswordRecovery(true);
        markReady(Boolean(session));
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (session) markReady(true);
      }
    });

    const timeout = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        markReady(Boolean(session) || capturePasswordRecovery());
      });
    }, 1200);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const showForm = hasSession || isPasswordRecovery;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/30">
            <Activity className="h-6 w-6 text-accent" />
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Trading
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gradient">
            EDGE LOG
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Update your password to finish recovery.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-6">
          {!ready ? (
            <div className="h-24 animate-pulse rounded-lg bg-white/5" />
          ) : !showForm ? (
            <div>
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                This reset link is invalid or expired. Request a new one from the
                forgot password page.
              </p>
              <Link
                href="/forgot-password"
                className="mt-4 inline-flex text-sm text-accent-hover hover:text-white"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">
                Update password
              </h2>
              <UpdatePasswordForm />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
