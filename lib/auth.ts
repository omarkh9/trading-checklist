import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, toSiteUrl } from "@/lib/auth-path";
import { ensureUserProfile } from "@/lib/supabase/profile";

export { getOwnerEmail, isOwnerEmail, isOwnerUser } from "@/lib/owner";
export {
  getAuthCallbackUrl,
  getAuthPageUrl,
  getRedirectUrl,
  safeNextPath,
  SITE_URL,
  toSiteUrl,
} from "@/lib/auth-path";

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).toLowerCase();
}

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

export function isUnconfirmedAuthError(error: unknown) {
  if (error instanceof Error && error.name === "AuthNeedsConfirmationError") {
    return true;
  }
  const message = errorText(error);
  return (
    message.includes("email not confirmed") || message.includes("not confirmed")
  );
}

export function isExistingAccountError(error: unknown) {
  if (error instanceof Error && error.name === "AuthAccountExistsError") {
    return true;
  }
  if (isUnconfirmedAuthError(error)) return true;
  const message = errorText(error);
  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already") ||
    (message.includes("already") && message.includes("account"))
  );
}

export function isInvalidCredentialsError(error: unknown) {
  const message = errorText(error);
  return (
    message.includes("invalid login") || message.includes("invalid credentials")
  );
}

export function mapAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Authentication failed.";
  const lower = message.toLowerCase();

  if (isUnconfirmedAuthError(error)) {
    return "This account exists but the email is not confirmed yet. Resend the confirmation link, or sign in if you already activated it.";
  }
  if (error instanceof Error && error.name === "AuthAccountExistsError") {
    return "An account with this email already exists. Sign in, or reset your password.";
  }
  if (lower.includes("already confirmed") || lower.includes("already been confirmed")) {
    return "This email is already confirmed. Sign in with your password.";
  }
  if (isInvalidCredentialsError(error)) {
    return "Incorrect email or password. Reset your password if you forgot it, or resend confirmation if you never activated the account.";
  }
  if (isExistingAccountError(error)) {
    return "An account with this email already exists. Sign in, or reset your password.";
  }
  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return "New accounts are not enabled yet. Try again shortly.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return message;
}

function namedError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export async function resendConfirmationEmail(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: toSiteUrl(getAuthCallbackUrl()) },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: toSiteUrl(getAuthCallbackUrl("/auth/update-password")) }
  );
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
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
    options: { emailRedirectTo: toSiteUrl(emailRedirectTo) },
  });
  if (error) {
    if (isExistingAccountError(error)) {
      throw namedError(
        "AuthAccountExistsError",
        "An account with this email already exists."
      );
    }
    throw error;
  }

  const identities = data.user?.identities ?? [];
  if (data.user && identities.length === 0) {
    try {
      await resendConfirmationEmail(normalizedEmail);
    } catch (resendError) {
      const resendMessage = errorText(resendError);
      if (resendMessage.includes("already") && resendMessage.includes("confirm")) {
        throw namedError(
          "AuthAccountExistsError",
          "An account with this email already exists."
        );
      }
    }
    throw namedError(
      "AuthNeedsConfirmationError",
      "This email is already registered but not confirmed yet."
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
  const [{ clearAccountsCache }, { clearTradesCache }, { clearChecklistCache }] =
    await Promise.all([
      import("@/lib/supabase/accounts"),
      import("@/lib/trades/trades-cache"),
      import("@/lib/checklist/checklist-cache"),
    ]);
  clearAccountsCache();
  clearTradesCache();
  clearChecklistCache();
}
