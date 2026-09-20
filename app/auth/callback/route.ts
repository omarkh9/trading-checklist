import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getRedirectUrl, getSiteOrigin, safeNextPath } from "@/lib/auth-path";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

function loginUrl(params: Record<string, string>) {
  const url = new URL(getRedirectUrl("/login"));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteOrigin();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isRecovery =
    type === "recovery" ||
    safeNextPath(searchParams.get("next")).startsWith("/auth/update-password");
  const next = isRecovery
    ? "/auth/update-password"
    : safeNextPath(searchParams.get("next"));
  const authError =
    searchParams.get("error_description") || searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      loginUrl({ error: "auth", error_description: authError })
    );
  }

  const supabase = await createClient();
  let sessionError: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) sessionError = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) sessionError = error.message;
  } else {
    return NextResponse.redirect(
      loginUrl({
        error: "auth",
        error_description: "Missing confirmation code.",
      })
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureUserProfile(supabase, user);
    return NextResponse.redirect(new URL(next, origin));
  }

  if (isRecovery) {
    return NextResponse.redirect(new URL(getRedirectUrl("/forgot-password")));
  }

  if (sessionError) {
    // Email can still be confirmed even when PKCE fails on another device.
    return NextResponse.redirect(loginUrl({ confirmed: "1" }));
  }

  return NextResponse.redirect(
    loginUrl({
      error: "auth",
      error_description:
        "Could not complete sign-in. Try signing in with your password.",
    })
  );
}
