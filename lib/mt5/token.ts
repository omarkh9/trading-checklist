export const MT5_WEBHOOK_PATH = "/api/mt5/webhook";
export const MT5_TOKEN_MIN_LENGTH = 16;

export function generateMt5WebhookToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashMt5WebhookToken(token: string) {
  const data = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function isUsableMt5Token(token: string) {
  return token.trim().length >= MT5_TOKEN_MIN_LENGTH;
}
