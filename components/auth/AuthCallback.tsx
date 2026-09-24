"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { reportAuthEvent } from "@/lib/auth-log";
import { markPasswordRecovery } from "@/lib/auth-recovery";
import { safeNextPath } from "@/lib/auth-path";
import { createClient } from "@/lib/supabase/client";
import { ensureUserProfile } from "@/lib/supabase/profile";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && OTP_TYPES.has(value as EmailOtpType));
}

function readHashParams() {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  return new URLSearchParams(raw);
}

function loginHref(params: Record<string, string>) {
  const url = new URL("/login", window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export function AuthCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Confirming your email...");

  useEffect(() => {
    let cancelled = false;

    async function finish(href: string) {
      if (cancelled) return;
      window.location.replace(href);
    }

    async function run() {
      const supabase = createClient();
      const hash = readHashParams();
      const typeValue = searchParams.get("type") || hash.get("type");
      const type = isOtpType(typeValue) ? typeValue : null;
      const nextFromQuery = safeNextPath(searchParams.get("next"));
      const isRecovery =
        type === "recovery" || nextFromQuery.startsWith("/auth/update-password");
      const next = isRecovery ? "/auth/update-password" : nextFromQuery;
      if (isRecovery) markPasswordRecovery();
      const queryError =
        searchParams.get("error_description") ||
        searchParams.get("error") ||
        hash.get("error_description") ||
        hash.get("error");

      await reportAuthEvent("callback_start", {
        hasCode: Boolean(searchParams.get("code")),
        hasTokenHash: Boolean(searchParams.get("token_hash")),
        hasToken: Boolean(searchParams.get("token")),
        hasHashSession: Boolean(hash.get("access_token")),
        type,
        queryError,
      });

      if (queryError) {
        await reportAuthEvent("callback_provider_error", { queryError, type });
        await finish(
          loginHref({ error: "auth", error_description: queryError })
        );
        return;
      }

      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        await ensureUserProfile(supabase, existing.session.user);
        await reportAuthEvent("callback_ok", {
          userId: existing.session.user.id,
          via: "existing_session",
          next,
          type,
        });
        await finish(next);
        return;
      }

      let sessionError: string | null = null;
      let handled = false;
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        handled = true;
        setStatus("Saving your session...");
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) sessionError = error.message;
      }

      const code = searchParams.get("code");
      if (!handled && code) {
        handled = true;
        setStatus("Finishing confirmation...");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) sessionError = error.message;
      }

      const tokenHash = searchParams.get("token_hash");
      const token = searchParams.get("token");
      const email = searchParams.get("email")?.trim().toLowerCase();

      if (!handled && tokenHash && type) {
        handled = true;
        setStatus("Verifying your email...");
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (error) sessionError = error.message;
      } else if (!handled && token && type) {
        handled = true;
        setStatus("Verifying your email...");
        const { error } = email
          ? await supabase.auth.verifyOtp({ type, token, email })
          : await supabase.auth.verifyOtp({ type, token_hash: token });
        if (error) sessionError = error.message;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await ensureUserProfile(supabase, user);
        await reportAuthEvent("callback_ok", {
          userId: user.id,
          confirmed: Boolean(user.email_confirmed_at),
          next,
          type,
        });
        await finish(next);
        return;
      }

      await reportAuthEvent("callback_no_session", {
        handled,
        sessionError,
        type,
        isRecovery,
      });

      if (isRecovery) {
        await finish("/forgot-password");
        return;
      }

      if (handled) {
        await finish(loginHref({ confirmed: "1" }));
        return;
      }

      await finish(
        loginHref({
          error: "auth",
          error_description:
            "This confirmation link is missing its token. Request a new email, then sign in.",
        })
      );
    }

    void run().catch(async (error) => {
      await reportAuthEvent("callback_exception", {
        message: error instanceof Error ? error.message : String(error),
      });
      await finish(
        loginHref({
          error: "auth",
          error_description:
            "Could not complete confirmation. Try signing in with your password.",
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-raised p-6 text-center">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-xl bg-accent/20" />
        <p className="mt-4 text-sm text-zinc-400">{status}</p>
      </div>
    </div>
  );
}
