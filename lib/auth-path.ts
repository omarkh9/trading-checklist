import { resolveSiteUrl } from "@/lib/supabase/public-config.mjs";

export const SITE_URL = "https://edge-log-11.netlify.app";

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function getSiteOrigin() {
  return (resolveSiteUrl() || SITE_URL).replace(/\/$/, "");
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
