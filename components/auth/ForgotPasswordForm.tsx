"use client";

import {
  getAuthPageUrl,
  getRedirectUrl,
  normalizeEmail,
  validateEmail,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Activity, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-400";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const loginHref = getAuthPageUrl("/login", {
    email: (sentTo || email).trim().toLowerCase(),
  });
  const homeHref = getRedirectUrl("/");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const normalized = normalizeEmail(email);
    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: "https://edge-log-11.netlify.app/auth/update-password",
    });

    if (error) {
      console.error("SUPABASE RECOVERY ERROR:", error.message, error);
      setError(error.message);
    } else {
      setSentTo(normalized);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href={homeHref}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/30"
            aria-label="Back to Edge Log"
          >
            {sentTo ? (
              <Mail className="h-6 w-6 text-accent" />
            ) : (
              <Activity className="h-6 w-6 text-accent" />
            )}
          </Link>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Trading
          </p>
          <Link href={homeHref}>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gradient">
              EDGE LOG
            </h1>
          </Link>
          <p className="mt-2 text-sm text-zinc-400">
            {sentTo
              ? "Reset email sent."
              : "Enter your registered email and we will send a reset link."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-6">
          {sentTo ? (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-zinc-100">
                Check your inbox
              </h2>
              <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-3 text-sm text-accent-hover">
                We sent a password reset link to{" "}
                <span className="font-medium text-zinc-100">{sentTo}</span>. Open
                that email and follow the link to choose a new password.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setError(null);
                }}
                className="mt-6 w-full rounded-lg border border-border bg-surface-overlay px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent/40 hover:text-white"
              >
                Use a different email
              </button>
              <p className="mt-4 text-center text-sm text-zinc-500">
                <Link href={loginHref} className="text-accent-hover hover:text-white">
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Sending reset link..." : "Send reset link"}
              </button>
              <p className="mt-4 text-center text-sm text-zinc-500">
                Remembered it?{" "}
                <Link href={loginHref} className="text-accent-hover hover:text-white">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

