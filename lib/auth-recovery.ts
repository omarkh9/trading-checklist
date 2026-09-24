export const PASSWORD_RECOVERY_STORAGE_KEY = "edge-log-password-recovery";
export const PASSWORD_RECOVERY_COOKIE = "edge-log-password-recovery";

export const PASSWORD_RECOVERY_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var hashRaw = location.hash.charAt(0) === "#" ? location.hash.slice(1) : "";
    var hash = new URLSearchParams(hashRaw);
    var query = new URLSearchParams(location.search);
    var type = String(hash.get("type") || query.get("type") || "").toLowerCase();
    var next = String(query.get("next") || "");
    if (type !== "recovery" && next.indexOf("update-password") === -1) return;
    try { sessionStorage.setItem("${PASSWORD_RECOVERY_STORAGE_KEY}", "1"); } catch (e) {}
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = "${PASSWORD_RECOVERY_COOKIE}=1; Path=/; Max-Age=3600; SameSite=Lax" + secure;
    var path = location.pathname || "/";
    if (path.indexOf("/auth/update-password") === 0 || path.indexOf("/auth/callback") === 0) return;
    location.replace("/auth/update-password" + location.search + location.hash);
  } catch (e) {}
})();`;

function canUseWindow() {
  return typeof window !== "undefined";
}

function readQueryAndHash() {
  if (!canUseWindow()) {
    return { hash: new URLSearchParams(), query: new URLSearchParams() };
  }
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  return {
    hash: new URLSearchParams(raw),
    query: new URLSearchParams(window.location.search),
  };
}

export function hashLooksLikeRecovery() {
  const { hash, query } = readQueryAndHash();
  const type = (hash.get("type") || query.get("type") || "").toLowerCase();
  return type === "recovery";
}

export function locationLooksLikeRecovery() {
  if (!canUseWindow()) return false;
  const { hash, query } = readQueryAndHash();
  const type = (hash.get("type") || query.get("type") || "").toLowerCase();
  const next = query.get("next") || "";
  return type === "recovery" || next.includes("update-password");
}

function writeRecoveryCookie(value: "1" | "") {
  if (!canUseWindow()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = value ? 3600 : 0;
  document.cookie = `${PASSWORD_RECOVERY_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function markPasswordRecovery() {
  try {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1");
  } catch {
    // Private mode can block storage.
  }
  writeRecoveryCookie("1");
}

export function clearPasswordRecovery() {
  try {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore persistence failures.
  }
  writeRecoveryCookie("");
}

export function hasPasswordRecoveryFlag() {
  try {
    return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function capturePasswordRecovery() {
  if (!canUseWindow()) return false;
  if (hasPasswordRecoveryFlag() || locationLooksLikeRecovery()) {
    markPasswordRecovery();
    return true;
  }
  return false;
}

export function isPasswordRecoveryActive() {
  return capturePasswordRecovery();
}
