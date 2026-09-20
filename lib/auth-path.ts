export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function isLocalHost(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

function trimSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getSiteOrigin() {
  const configured = trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  const browserOrigin =
    typeof window !== "undefined" ? trimSlash(window.location.origin) : "";
  const browserHost =
    typeof window !== "undefined" ? window.location.hostname : "";
  const browserIsLocal =
    browserHost === "localhost" || browserHost === "127.0.0.1";

  if (browserOrigin && !browserIsLocal) {
    return browserOrigin;
  }

  if (configured && !isLocalHost(configured)) {
    return configured;
  }

  return browserOrigin || configured;
}

export function getAuthCallbackUrl(nextPath = "/") {
  const origin = getSiteOrigin();
  const url = new URL("/auth/callback", `${origin}/`);
  const next = safeNextPath(nextPath);
  if (next !== "/") {
    url.searchParams.set("next", next);
  }
  return url.toString();
}
