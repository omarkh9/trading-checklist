import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getMt5CredentialsKey, getMt5CredentialsKeyCandidates } from "@/lib/mt5/env";
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

function keyMaterials() {
  const materials = [...getMt5CredentialsKeyCandidates(), derivedFallbackKey()];
  return materials.filter(
    (material, index) => material && materials.indexOf(material) === index
  );
}

function keyBytes(material = resolveKeyMaterial()) {
  return createHash("sha256").update(material).digest();
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

function decryptWithMaterial(payload: string, material: string) {
  const [version, ivPart, dataPart, tagPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !dataPart || !tagPart) {
    throw new Error("Stored MT5 credentials are not readable.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(material),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptMt5Secret(payload: string) {
  const materials = keyMaterials();
  let lastError: unknown = null;
  for (const material of materials) {
    try {
      return decryptWithMaterial(payload, material);
    } catch (cause) {
      lastError = cause;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Stored MT5 credentials are not readable.");
}

export function decryptStoredInvestorPassword(cipher: string | null | undefined) {
  const payload = cipher?.trim() ?? "";
  if (!payload) return "";
  if (!payload.startsWith("v1.")) return payload;
  return decryptMt5Secret(payload);
}
