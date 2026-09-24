"use client";

import { getRedirectUrl, validatePassword } from "@/lib/auth";
import {
  clearPasswordRecovery,
  markPasswordRecovery,
} from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-400";

type UpdatePasswordFormProps = {
  heading?: string;
};

export function UpdatePasswordForm({
  heading = "Set a new password for your account.",
}: UpdatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecovery();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage("");

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error("Error updating password:", updateError.message);
      console.error("Full Supabase Error:", updateError);
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    clearPasswordRecovery();
    setMessage("Password updated successfully! Redirecting...");
    window.setTimeout(() => {
      window.location.assign(getRedirectUrl("/"));
    }, 2000);
  };

  return (
    <form onSubmit={handleUpdatePassword}>
      <p className="mb-4 text-sm text-zinc-400">{heading}</p>
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-3 text-sm text-accent-hover">
          {message}
        </p>
      )}
      <div>
        <label htmlFor="new-password" className={labelClass}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter new password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          required
          minLength={8}
        />
      </div>
      <div className="mt-4">
        <label htmlFor="confirm-new-password" className={labelClass}>
          Confirm password
        </label>
        <input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className={inputClass}
          required
          minLength={8}
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
