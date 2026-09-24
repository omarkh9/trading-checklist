"use client";

import {
  getRedirectUrl,
  mapAuthError,
  updatePassword,
  validatePassword,
} from "@/lib/auth";
import { clearPasswordRecovery } from "@/lib/auth-recovery";
import { useState } from "react";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

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
    try {
      await updatePassword(password);
      clearPasswordRecovery();
      window.location.assign(getRedirectUrl("/"));
    } catch (cause) {
      setError(mapAuthError(cause));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-4 text-sm text-zinc-400">{heading}</p>
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
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
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter your password"
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
        {isSubmitting ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}
