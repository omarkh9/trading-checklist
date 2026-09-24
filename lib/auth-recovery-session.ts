import { markPasswordRecovery } from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType, Session } from "@supabase/supabase-js";

function readHashParams() {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  return new URLSearchParams(raw);
}

function isRecoveryType(value: string | null) {
  return (value || "").toLowerCase() === "recovery";
}

export async function establishRecoverySession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  const supabase = createClient();
  const hash = readHashParams();
  const query = new URLSearchParams(window.location.search);
  const typeValue = hash.get("type") || query.get("type");
  if (isRecoveryType(typeValue)) markPasswordRecovery();

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) {
    markPasswordRecovery();
    return existing.session;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.error("Full Supabase Error:", error);
    } else if (data.session) {
      markPasswordRecovery();
      return data.session;
    }
  }

  const code = query.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Full Supabase Error:", error);
    } else if (data.session) {
      markPasswordRecovery();
      return data.session;
    }
  }

  const tokenHash = query.get("token_hash") || hash.get("token_hash");
  const token = query.get("token");
  const email = query.get("email")?.trim().toLowerCase();
  const otpType: EmailOtpType | null = isRecoveryType(typeValue)
    ? "recovery"
    : null;

  if (otpType && tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error) {
      console.error("Full Supabase Error:", error);
    } else if (data.session) {
      markPasswordRecovery();
      return data.session;
    }
  } else if (otpType && token) {
    const { data, error } = email
      ? await supabase.auth.verifyOtp({ type: otpType, token, email })
      : await supabase.auth.verifyOtp({ type: otpType, token_hash: token });
    if (error) {
      console.error("Full Supabase Error:", error);
    } else if (data.session) {
      markPasswordRecovery();
      return data.session;
    }
  }

  const { data: after } = await supabase.auth.getSession();
  if (after.session) markPasswordRecovery();
  return after.session ?? null;
}
