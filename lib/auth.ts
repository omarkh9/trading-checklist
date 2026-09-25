import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, toSiteUrl } from "@/lib/auth-path";
import {
  authErrorFields,
  emailLogFields,
  normalizeEmail,
  reportAuthEvent,
} from "@/lib/auth-log";
import { ensureUserProfile } from "@/lib/supabase/profile";

export { normalizeEmail } from "@/lib/auth-log";
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

export function getAuthErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code ?? "").toLowerCase();
  }
  return "";
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
  if (getAuthErrorCode(error) === "email_not_confirmed") {
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
  const code = getAuthErrorCode(error);
  if (code === "invalid_credentials" || code === "invalid_login_credentials") {
    return true;
  }
  const message = errorText(error);
  return (
    message.includes("invalid login") || message.includes("invalid credentials")
  );
}

export function mapAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Authentication failed.";
  const lower = message.toLowerCase();
  const code = getAuthErrorCode(error);

  if (code === "email_not_confirmed" || isUnconfirmedAuthError(error)) {
    return "This account exists but the email is not confirmed yet. Open the confirmation link, resend it, or sign in if you already activated the account.";
  }
  if (error instanceof Error && error.name === "AuthAccountExistsError") {
    return "An account with this email already exists. Sign in, or reset your password.";
  }
  if (lower.includes("already confirmed") || lower.includes("already been confirmed")) {
    return "This email is already confirmed. Sign in with your password.";
  }
  if (code === "user_banned") {
    return "This account is disabled. Contact support if that looks wrong.";
  }
  if (isInvalidCredentialsError(error)) {
    return "Incorrect email or password. Reset your password if you forgot it, or resend confirmation if you never activated the account.";
  }
  if (
    lower.includes("new password") ||
    lower.includes("same password") ||
    lower.includes("password should be different")
  ) {
    return "Choose a new password that is different from your current one.";
  }
  if (isExistingAccountError(error)) {
    return "An account with this email already exists. Sign in, or reset your password.";
  }
  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return "New accounts are not enabled yet. Try again shortly.";
  }
  if (
    code === "over_request_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("too many")
  ) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (code === "no_session" || lower.includes("did not create a session")) {
    return "Your email still needs to be confirmed before a session can be created. Open the latest confirmation link, then sign in.";
  }
  if (
    lower.includes("unable to sign in") ||
    lower.includes("unable to login") ||
    lower.includes("error signing in") ||
    lower.includes("auth session missing")
  ) {
    return "Unable to sign in. Confirm the email if you have not already, check your password, or reset it and try again.";
  }

  return "Unable to sign in. Check your email and password, confirm the account if needed, or reset your password.";
}

function namedError(name: string, message: string, code?: string, status?: number) {
  const error = new Error(message) as Error & { code?: string; status?: number };
  error.name = name;
  if (code) error.code = code;
  if (typeof status === "number") error.status = status;
  return error;
}

function attachAuthError(
  name: string,
  message: string,
  details: { code?: string | null; status?: number | null; name?: string | null }
) {
  return namedError(
    details.name || name,
    message,
    details.code ?? undefined,
    details.status ?? undefined
  );
}

export async function resendConfirmationEmail(email: string) {
  const normalized = normalizeEmail(email);
  await reportAuthEvent("resend_confirmation", emailLogFields(normalized));
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalized,
    options: { emailRedirectTo: toSiteUrl(getAuthCallbackUrl()) },
  });
  if (error) {
    await reportAuthEvent("resend_confirmation_failed", {
      ...emailLogFields(normalized),
      ...authErrorFields(error),
    });
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    { redirectTo: "https://edgelog.org/auth/update-password" }
  );
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

async function signInWithEmailClient(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw namedError(
      "AuthSignInError",
      "Sign-in did not create a session. Confirm your email, then try again.",
      "no_session",
      401
    );
  }
  await ensureUserProfile(supabase, data.user);
  return data;
}

async function signInWithEmailViaApi(email: string, password: string) {
  const response = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    code?: string | null;
    status?: number | null;
    name?: string | null;
  } | null;

  if (!response.ok || !payload?.ok) {
    const message = payload?.error || `Unable to sign in (${response.status}).`;
    const error = attachAuthError("AuthSignInError", message, payload ?? {});
    if (isUnconfirmedAuthError(error) || payload?.code === "email_not_confirmed") {
      throw namedError(
        "AuthNeedsConfirmationError",
        message,
        payload?.code ?? "email_not_confirmed",
        payload?.status ?? 401
      );
    }
    throw error;
  }

  return payload;
}

export async function signInWithEmail(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const started = Date.now();

  await reportAuthEvent("sign_in_attempt", {
    ...emailLogFields(normalizedEmail),
    via: "client",
  });

  try {
    const data = await signInWithEmailViaApi(normalizedEmail, password);
    await reportAuthEvent("sign_in_ok", {
      ...emailLogFields(normalizedEmail),
      via: "api",
      ms: Date.now() - started,
    });
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      await reportAuthEvent("sign_in_api_unreachable", {
        ...emailLogFields(normalizedEmail),
        ...authErrorFields(error),
        ms: Date.now() - started,
      });
      try {
        const data = await signInWithEmailClient(normalizedEmail, password);
        await reportAuthEvent("sign_in_ok", {
          ...emailLogFields(normalizedEmail),
          via: "client_fallback",
          ms: Date.now() - started,
        });
        return data;
      } catch (fallbackError) {
        await reportAuthEvent("sign_in_failed", {
          ...emailLogFields(normalizedEmail),
          ...authErrorFields(fallbackError),
          via: "client_fallback",
          ms: Date.now() - started,
        });
        throw fallbackError;
      }
    }

    await reportAuthEvent("sign_in_failed", {
      ...emailLogFields(normalizedEmail),
      ...authErrorFields(error),
      via: "api",
      ms: Date.now() - started,
    });
    throw error;
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  emailRedirectTo: string
) {
  const supabase = createClient();
  const normalizedEmail = normalizeEmail(email);
  await reportAuthEvent("sign_up_attempt", emailLogFields(normalizedEmail));
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { emailRedirectTo: toSiteUrl(emailRedirectTo) },
  });
  if (error) {
    await reportAuthEvent("sign_up_failed", {
      ...emailLogFields(normalizedEmail),
      ...authErrorFields(error),
    });
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

  await reportAuthEvent("sign_up_ok", {
    ...emailLogFields(normalizedEmail),
    hasSession: Boolean(data.session),
    needsConfirmation: !data.session,
  });

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
