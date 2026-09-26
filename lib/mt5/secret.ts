import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getMt5CredentialsKey } from "@/lib/mt5/env";
import {
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "@/lib/supabase/public-config.mjs";

function derivedFallbackKey() {
  return createHash("sha256")
    .update("edge-log.mt5.credentials.v1")
    .update("\0")
    .update(resolveSupabaseUrl())
    .update("\0")
    .update(resolveSupabaseAnonKey())
    .digest("hex");
}

function resolveKeyMaterial() {
  return getMt5CredentialsKey() || derivedFallbackKey();
}

function keyBytes() {
  return createHash("sha256").update(resolveKeyMaterial()).digest();
}

export function canEncryptMt5Secret() {
  return Boolean(resolveKeyMaterial());
}

export function encryptMt5Secret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptMt5Secret(payload: string) {
  const [version, ivPart, dataPart, tagPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !dataPart || !tagPart) {
    throw new Error("Stored MT5 credentials are not readable.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptStoredInvestorPassword(cipher: string | null | undefined) {
  const payload = cipher?.trim() ?? "";
  if (!payload) return "";
  return decryptMt5Secret(payload);
}
