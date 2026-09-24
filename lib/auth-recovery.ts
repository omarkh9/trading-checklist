const RECOVERY_FLAG = "edge-log-password-recovery";

export function markPasswordRecovery() {
  try {
    window.sessionStorage.setItem(RECOVERY_FLAG, "1");
  } catch {
    // Private mode can block storage.
  }
}

export function clearPasswordRecovery() {
  try {
    window.sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // Ignore persistence failures.
  }
}

export function hasPasswordRecoveryFlag() {
  try {
    return window.sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

export function hashLooksLikeRecovery() {
  if (typeof window === "undefined") return false;
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  const hash = new URLSearchParams(raw);
  const type = (hash.get("type") || "").toLowerCase();
  return type === "recovery";
}
