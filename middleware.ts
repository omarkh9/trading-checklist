import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth-recovery";
import { getAuthPageUrl, getRedirectUrl } from "@/lib/auth-path";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

function isPasswordRecoveryRequest(request: NextRequest) {
  if (request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value === "1") return true;
  const type = request.nextUrl.searchParams.get("type")?.toLowerCase();
  const next = request.nextUrl.searchParams.get("next") || "";
  return type === "recovery" || next.includes("update-password");
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mt5/webhook") ||
    pathname.startsWith("/api/news/calendar") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  );
}

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return copySessionCookies(
        supabaseResponse,
        NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
      );
    }
    const url = new URL(getAuthPageUrl("/login", { next: pathname }));
    return copySessionCookies(supabaseResponse, NextResponse.redirect(url));
  }

  if (
    user &&
    (pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/forgot-password"))
  ) {
    const destination = isPasswordRecoveryRequest(request)
      ? new URL("/auth/update-password", request.url)
      : new URL(getRedirectUrl("/"));
    return copySessionCookies(
      supabaseResponse,
      NextResponse.redirect(destination)
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/mt5/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
