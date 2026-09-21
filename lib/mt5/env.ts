import { sanitizeEnvValue } from "@/lib/supabase/public-config.mjs";

export function getMt5GatewayUrl() {
  return sanitizeEnvValue(process.env.MT5_GATEWAY_URL).replace(/\/$/, "");
}

export function getMt5GatewaySecret() {
  return sanitizeEnvValue(process.env.MT5_GATEWAY_SECRET);
}

export function getMetaApiToken() {
  return (
    sanitizeEnvValue(process.env.METAAPI_TOKEN) ||
    sanitizeEnvValue(process.env.MT5_METAAPI_TOKEN)
  );
}
