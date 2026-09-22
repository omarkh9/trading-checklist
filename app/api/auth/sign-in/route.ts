import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { authErrorFields, emailLogFields, logAuth } from "@/lib/auth-log";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { ensureUserProfile } from "@/lib/supabase/profile";

export const dynamic = "force-dynamic";

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  let email = "";

  try {
    let body: { email?: unknown; password?: unknown };
    try {
      body = (await request.json()) as { email?: unknown; password?: unknown };
    } catch {
      logAuth("sign_in_failed", {
        reason: "invalid_json",
        ms: Date.now() - started,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to sign in.",
          code: "invalid_json",
          status: 400,
          name: "AuthSignInError",
        },
        { status: 400 }
      );
    }
    email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    logAuth("sign_in_attempt", {
      ...emailLogFields(email),
      via: "api",
    });

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logAuth("sign_in_failed", {
        ...emailLogFields(email),
        reason: "invalid_email",
        ms: Date.now() - started,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid email address.",
          code: "invalid_email",
          status: 400,
          name: "AuthSignInError",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      logAuth("sign_in_failed", {
        ...emailLogFields(email),
        reason: "invalid_password",
        ms: Date.now() - started,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Password must be at least 8 characters.",
          code: "invalid_password",
          status: 400,
          name: "AuthSignInError",
        },
        { status: 400 }
      );
    }

    const pendingCookies: {
      name: string;
      value: string;
      options?: Parameters<NextResponse["cookies"]["set"]>[2];
    }[] = [];

    const supabase = createServerClient<Database>(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const fields = authErrorFields(error);
      logAuth("sign_in_failed", {
        ...emailLogFields(email),
        ...fields,
        reason: fields.code || fields.message,
        ms: Date.now() - started,
      });
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Unable to sign in.",
          code: fields.code,
          status: fields.status ?? 401,
          name: fields.name || "AuthSignInError",
        },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      logAuth("sign_in_failed", {
        ...emailLogFields(email),
        reason: "no_session",
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        confirmed: Boolean(data.user?.email_confirmed_at),
        ms: Date.now() - started,
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sign-in did not create a session. Confirm your email, then try again.",
          code: "no_session",
          status: 401,
          name: "AuthSignInError",
        },
        { status: 401 }
      );
    }

    await ensureUserProfile(supabase, data.user);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        confirmed: Boolean(data.user.email_confirmed_at),
      },
    });

    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    logAuth("sign_in_ok", {
      ...emailLogFields(email),
      userId: data.user.id,
      confirmed: Boolean(data.user.email_confirmed_at),
      cookieCount: pendingCookies.length,
      ms: Date.now() - started,
    });

    return response;
  } catch (error) {
    const fields = authErrorFields(error);
    logAuth("sign_in_failed", {
      ...emailLogFields(email),
      ...fields,
      reason: "exception",
      ms: Date.now() - started,
    });
    return NextResponse.json(
      {
        ok: false,
        error: fields.message || "Unable to sign in.",
        code: fields.code || "exception",
        status: 500,
        name: fields.name || "AuthSignInError",
      },
      { status: 500 }
    );
  }
}
