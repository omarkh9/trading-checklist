"use client";

import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import {
  getAuthCallbackUrl,
  getAuthPageUrl,
  getRedirectUrl,
  isExistingAccountError,
  isInvalidCredentialsError,
  isUnconfirmedAuthError,
  mapAuthError,
  resendConfirmationEmail,
  safeNextPath,
  signInWithEmail,
  signUpWithEmail,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import {
  hasPasswordRecoveryFlag,
  hashLooksLikeRecovery,
  markPasswordRecovery,
} from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/client";
import { Activity } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-400";

const secondaryButtonClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

const recoveryPrimaryClass =
  "block w-full rounded-lg bg-accent px-5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [accountExists, setAccountExists] = useState(
    searchParams.get("existing") === "1"
  );
  const [showPasswordReset, setShowPasswordReset] = useState(
    searchParams.get("existing") === "1" || searchParams.get("error") === "auth"
  );
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (hasPasswordRecoveryFlag() || hashLooksLikeRecovery()) {
      markPasswordRecovery();
      setRecoveryMode(true);
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecovery();
        setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isSignup = mode === "signup";
  const normalizedEmail = email.trim().toLowerCase();

  const queryError = useMemo(() => {
    const description = searchParams.get("error_description");
    const code = searchParams.get("error");
    if (description) return description.replace(/\+/g, " ");
    if (code === "auth") {
      return "Could not confirm that email link. Request a new one, sign in, or reset your password.";
    }
    return null;
  }, [searchParams]);

  const queryInfo = useMemo(() => {
    if (searchParams.get("existing") === "1") {
      return "This email already has an account. Sign in below, or reset your password if you forgot it.";
    }
    if (searchParams.get("confirmed") === "1") {
      return "Your email is confirmed. Sign in with your password to continue.";
    }
    return null;
  }, [searchParams]);

  const loginHref = getAuthPageUrl("/login", {
    next: nextPath,
    email: normalizedEmail,
    existing: accountExists,
  });
  const signupHref = getAuthPageUrl("/signup", {
    next: nextPath,
    email: normalizedEmail,
  });
  const resetHref = getAuthPageUrl("/forgot-password", {
    next: nextPath,
    email: normalizedEmail,
  });
  const homeHref = getRedirectUrl("/");

  const showRecovery = Boolean(
    needsConfirmation ||
      showPasswordReset ||
      accountExists ||
      queryError ||
      queryInfo ||
      (isSignup && error)
  );

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const showExistingAccountFeedback = (cause: unknown) => {
    setAccountExists(true);
    setShowPasswordReset(true);
    setNeedsConfirmation(false);
    setError(mapAuthError(cause));
    setInfo(null);
  };

  const handleResend = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsSubmitting(true);
    resetMessages();
    try {
      await resendConfirmationEmail(normalizedEmail);
      setNeedsConfirmation(true);
      setInfo(
        "If this account still needs to be activated, we sent a new confirmation link. Open it, then sign in."
      );
    } catch (cause) {
      if (isExistingAccountError(cause) && !isUnconfirmedAuthError(cause)) {
        showExistingAccountFeedback(cause);
        return;
      }
      setError(mapAuthError(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setNeedsConfirmation(false);
    setShowPasswordReset(false);
    setAccountExists(false);

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
          normalizedEmail,
          password,
          getAuthCallbackUrl(nextPath)
        );

        if (!data.session) {
          setNeedsConfirmation(true);
          setInfo(
            "Account created. Check your email and open the confirmation link to finish signing in."
          );
          setPassword("");
          setConfirmPassword("");
          return;
        }
      } else {
        await signInWithEmail(normalizedEmail, password);
      }

      window.location.assign(nextPath);
    } catch (cause) {
      const alreadyResent =
        cause instanceof Error && cause.name === "AuthNeedsConfirmationError";

      if (
        isSignup &&
        isExistingAccountError(cause) &&
        !isUnconfirmedAuthError(cause)
      ) {
        showExistingAccountFeedback(cause);
        return;
      }

      if (isUnconfirmedAuthError(cause)) {
        setError(null);
        setNeedsConfirmation(true);
        setShowPasswordReset(true);
        setInfo(
          "This email is registered but not confirmed yet. Resend the link, sign in if you already confirmed, or reset your password."
        );
        if (!alreadyResent) {
          try {
            await resendConfirmationEmail(normalizedEmail);
            setInfo(
              "We sent a new confirmation link. Open it, then sign in. You can also reset your password."
            );
          } catch {
            setError(mapAuthError(cause));
          }
        }
        return;
      }

      setError(mapAuthError(cause));
      if (isInvalidCredentialsError(cause) || isExistingAccountError(cause)) {
        setShowPasswordReset(true);
        if (isExistingAccountError(cause)) {
          setAccountExists(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
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
            <Activity className="h-6 w-6 text-accent" />
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
            {recoveryMode
              ? "Choose a new password to finish resetting your account."
              : isSignup
                ? "Create an account to start logging your own trades."
                : "Sign in to view and log your trades."}
          </p>
        </div>

        {recoveryMode ? (
          <div className="rounded-xl border border-border bg-surface-raised p-6">
            <h2 className="mb-1 text-lg font-semibold text-zinc-100">
              Update password
            </h2>
            <UpdatePasswordForm heading="Enter a new password, then you will continue into the desk." />
          </div>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface-raised p-6"
        >
          {(error || queryError) && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3">
              <p className="text-sm text-red-300">{error ?? queryError}</p>
            </div>
          )}
          {(info || (!error && !queryError && queryInfo)) && (
            <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-3">
              <p className="text-sm text-accent-hover">{info ?? queryInfo}</p>
            </div>
          )}

          {showRecovery && (
            <div className="mb-4 flex flex-col gap-2">
              {(needsConfirmation || queryError) && email && (
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={isSubmitting}
                  className={secondaryButtonClass}
                >
                  Resend confirmation email
                </button>
              )}
              {isSignup && (
                <Link href={loginHref} className={recoveryPrimaryClass}>
                  Sign in instead
                </Link>
              )}
              <Link
                href={resetHref}
                className={`${secondaryButtonClass} block text-center`}
              >
                Reset password
              </Link>
            </div>
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

          {!isSignup && (
            <Link
              href={resetHref}
              className="mt-3 inline-block text-sm text-zinc-500 transition-colors hover:text-white"
            >
              Forgot password?
            </Link>
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
                <Link href={loginHref} className="text-accent-hover hover:text-white">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link href={signupHref} className="text-accent-hover hover:text-white">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </form>
        )}
      </div>
    </div>
  );
}
