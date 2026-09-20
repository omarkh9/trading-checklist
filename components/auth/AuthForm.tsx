"use client";

import {
  mapAuthError,
  safeNextPath,
  signInWithEmail,
  signUpWithEmail,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import { Activity } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-400";

type AuthFormProps = {
  mode: "login" | "signup";
};

function withNext(href: string, nextPath: string) {
  if (nextPath === "/") return href;
  const url = new URL(href, "http://local.invalid");
  url.searchParams.set("next", nextPath);
  return `${url.pathname}${url.search}`;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === "signup";

  const queryError = useMemo(() => {
    const description = searchParams.get("error_description");
    const code = searchParams.get("error");
    if (description) return description.replace(/\+/g, " ");
    if (code === "auth") {
      return "Could not confirm that email link. Request a new one or sign in.";
    }
    return null;
  }, [searchParams]);

  const queryInfo =
    searchParams.get("confirmed") === "1"
      ? "Email confirmed. Sign in to continue."
      : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const data = await signUpWithEmail(
          email,
          password,
          `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
        );

        if (!data.session) {
          setInfo(
            "Account created. Check your email to confirm, then sign in. Open the link on this device."
          );
          setPassword("");
          setConfirmPassword("");
          return;
        }
      } else {
        await signInWithEmail(email, password);
      }

      router.replace(nextPath);
      router.refresh();
    } catch (cause) {
      setError(mapAuthError(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {isSignup
              ? "Create an account to start logging your own trades."
              : "Sign in to view and log your trades."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface-raised p-6"
        >
          {(error || queryError) && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error ?? queryError}
            </p>
          )}
          {(info || (!error && !queryError && queryInfo)) && (
            <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-hover">
              {info ?? queryInfo}
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

          <div className="mt-4">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
              required
              minLength={8}
            />
          </div>

          {isSignup && (
            <div className="mt-4">
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={inputClass}
                required
                minLength={8}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? isSignup
                ? "Creating account..."
                : "Signing in..."
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>

          <p className="mt-4 text-center text-sm text-zinc-500">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link
                  href={withNext("/login", nextPath)}
                  className="text-accent-hover hover:text-white"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link
                  href={withNext("/signup", nextPath)}
                  className="text-accent-hover hover:text-white"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
