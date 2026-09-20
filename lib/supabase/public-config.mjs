/** Publishable Supabase values. Safe to ship in the client bundle. */
export const supabasePublicConfig = {
  url: "https://agfzhwyhrrcbadbzvmpy.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZnpod3locnJjYmFkYnp2bXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzU3ODUsImV4cCI6MjEwNTQxMTc4NX0.WhUxOHsGYOHkad86--jDbiD6EmBNnoh8pDXHQwbQOpE",
  ownerEmail: "Omar.khallil@outlook.com",
};

export function sanitizeEnvValue(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^["']|["']$/g, "");

  if (!cleaned || cleaned === "undefined" || cleaned === "null") {
    return "";
  }

  return cleaned;
}

export function resolveSupabaseUrl() {
  const url =
    sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    sanitizeEnvValue(process.env.VITE_SUPABASE_URL);

  return url || supabasePublicConfig.url;
}

export function resolveSupabaseAnonKey() {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    supabasePublicConfig.anonKey,
  ];

  for (const candidate of candidates) {
    const key = sanitizeEnvValue(candidate);
    if (key.startsWith("eyJ") || key.startsWith("sb_publishable_")) {
      return key;
    }
  }

  return supabasePublicConfig.anonKey;
}

export function resolveOwnerEmail() {
  return (
    sanitizeEnvValue(process.env.NEXT_PUBLIC_OWNER_EMAIL) ||
    supabasePublicConfig.ownerEmail
  );
}

function isLocalHost(value) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

export function resolveSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitizeEnvValue(candidate).replace(/\/$/, "");
    if (cleaned && !isLocalHost(cleaned)) {
      return cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
    }
  }

  return "";
}
