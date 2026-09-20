import { SITE_URL } from "@/lib/site";

export { SITE_URL } from "@/lib/site";

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function getSiteOrigin() {
  return SITE_URL.replace(/\/$/, "");
}

export function getRedirectUrl(path = "") {
  const origin = getSiteOrigin();
  if (!path) return origin;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export function getAuthCallbackUrl(nextPath = "/") {
  const url = new URL(getRedirectUrl("/auth/callback"));
  const next = safeNextPath(nextPath);
  if (next !== "/") {
    url.searchParams.set("next", next);
  }
  return url.toString();
}

type AuthPagePath = "/login" | "/signup" | "/forgot-password";

export function getAuthPageUrl(
  path: AuthPagePath,
  options: {
    next?: string;
    email?: string;
    existing?: boolean;
    confirmed?: boolean;
  } = {}
) {
  const url = new URL(getRedirectUrl(path));
  const next = safeNextPath(options.next);
  if (next !== "/") {
    url.searchParams.set("next", next);
  }
  const email = options.email?.trim().toLowerCase();
  if (email) {
    url.searchParams.set("email", email);
  }
  if (options.existing) {
    url.searchParams.set("existing", "1");
  }
  if (options.confirmed) {
    url.searchParams.set("confirmed", "1");
  }
  return url.toString();
}
