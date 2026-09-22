type AuthLogDetails = Record<string, unknown>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailLogFields(email: string | null | undefined) {
  const normalized = normalizeEmail(email ?? "");
  const at = normalized.indexOf("@");
  const local = at >= 0 ? normalized.slice(0, at) : normalized;
  const domain = at >= 0 ? normalized.slice(at + 1) : "";
  return {
    emailDomain: domain || null,
    emailPrefix: local ? `${local.slice(0, 2)}***` : null,
    emailLength: normalized.length,
  };
}

export function authErrorFields(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      message: String(error),
      name: null,
      code: null,
      status: null,
    };
  }

  const value = error as {
    message?: string;
    name?: string;
    code?: string;
    status?: number;
  };

  return {
    message: value.message ?? String(error),
    name: value.name ?? null,
    code: value.code ?? null,
    status: typeof value.status === "number" ? value.status : null,
  };
}

export function logAuth(event: string, details: AuthLogDetails = {}) {
  console.info(
    "[auth]",
    JSON.stringify({
      scope: "auth",
      event,
      at: new Date().toISOString(),
      ...details,
    })
  );
}

export async function reportAuthEvent(
  event: string,
  details: AuthLogDetails = {}
) {
  logAuth(event, details);
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/auth/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, details }),
      keepalive: true,
    });
  } catch {
    // Logging must never block sign-in.
  }
}
