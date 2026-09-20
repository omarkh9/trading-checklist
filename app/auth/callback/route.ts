import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth-path";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

function loginErrorUrl(origin: string, description?: string | null) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth");
  if (description) {
    url.searchParams.set("error_description", description);
  }
  return url;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));
  const authError =
    searchParams.get("error_description") || searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(loginErrorUrl(origin, authError));
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(loginErrorUrl(origin, error.message));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(loginErrorUrl(origin, error.message));
    }
  } else {
    return NextResponse.redirect(loginErrorUrl(origin, "Missing confirmation code."));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await ensureUserProfile(supabase, user);
  }

  return NextResponse.redirect(new URL(next, origin));
}
