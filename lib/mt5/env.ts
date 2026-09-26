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

export function getMt5SyncSecret() {
  return (
    sanitizeEnvValue(process.env.MT5_SYNC_SECRET) || getMt5GatewaySecret()
  );
}

export function getSupabaseServiceRoleKey() {
  return (
    sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    sanitizeEnvValue(process.env.SUPABASE_SERVICE_KEY)
  );
}

export function canFetchMt5History() {
  return Boolean(getMt5GatewayUrl() || getMetaApiToken());
}
