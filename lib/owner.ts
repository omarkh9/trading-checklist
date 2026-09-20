const DEFAULT_OWNER_EMAIL = "Omar.khallil@outlook.com";

export function getOwnerEmail() {
  const fromEnv = process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim();
  return fromEnv || DEFAULT_OWNER_EMAIL;
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
