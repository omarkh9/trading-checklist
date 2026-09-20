import { createClient } from "@/lib/supabase/client";
import { ensureUserProfile } from "@/lib/supabase/profile";

export { getOwnerEmail, isOwnerEmail, isOwnerUser } from "@/lib/owner";
export { safeNextPath } from "@/lib/auth-path";

export function validateEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function mapAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Authentication failed.";
  const lower = message.toLowerCase();

  if (lower.includes("invalid login")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in. Check your inbox for the link.";
  }
  if (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("user already")
  ) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return "New accounts are not enabled yet. Try again shortly.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return message;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  if (data.user) {
    await ensureUserProfile(supabase, data.user);
  }
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  emailRedirectTo: string
) {
  const supabase = createClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { emailRedirectTo },
  });
  if (error) throw error;

  const identities = data.user?.identities ?? [];
  if (data.user && identities.length === 0) {
    throw new Error(
      "An account with this email already exists. Sign in instead."
    );
  }

  if (data.user && data.session) {
    await ensureUserProfile(supabase, data.user);
  }

  return data;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
