import { resolveOwnerEmail } from "@/lib/supabase/public-config.mjs";

export function getOwnerEmail() {
  return resolveOwnerEmail();
}

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isOwnerEmail(email: string | null | undefined) {
  const owner = normalizeEmail(getOwnerEmail());
  const candidate = normalizeEmail(email);
  return Boolean(owner && candidate && candidate === owner);
}

export function isOwnerUser(
  user: { email?: string | null } | null | undefined
) {
  return isOwnerEmail(user?.email);
}
