import { SITE_URL } from "@/lib/site";

export { SITE_URL } from "@/lib/site";

const PRODUCTION_ORIGIN = "https://edgelog.org";

function isLocalHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

export function getSiteOrigin() {
  try {
    const origin = new URL(SITE_URL).origin;
    if (!origin || isLocalHost(new URL(origin).hostname)) {
      return PRODUCTION_ORIGIN;
    }
    return origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

export function toSiteUrl(pathOrUrl: string) {
  const origin = getSiteOrigin();
  try {
    const parsed = new URL(pathOrUrl, origin);
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return origin;
  }
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function getRedirectUrl(path = "") {
  const origin = getSiteOrigin();
  if (!path) return origin;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return toSiteUrl(`${origin}${normalized}`);
}

export function getAuthCallbackUrl(nextPath = "/") {
  const url = new URL(getRedirectUrl("/auth/callback"));
  const next = safeNextPath(nextPath);
  if (next !== "/") {
    url.searchParams.set("next", next);
  }
  return toSiteUrl(url.toString());
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
  return toSiteUrl(url.toString());
}
