import { sanitizeEnvValue } from "@/lib/supabase/public-config.mjs";

export function getMt5GatewayUrl() {
  return sanitizeEnvValue(process.env.MT5_GATEWAY_URL).replace(/\/$/, "");
}

export function getMt5GatewaySecret() {
  return sanitizeEnvValue(process.env.MT5_GATEWAY_SECRET);
}

// localtunnel serves an HTML reminder page instead of proxying unless this header is sent.
export function getMt5GatewayHeaders(): Record<string, string> {
  const secret = getMt5GatewaySecret();
  return {
    "Bypass-Tunnel-Reminder": "true",
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };
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

export function getMt5CredentialsKey() {
  return getMt5CredentialsKeyCandidates()[0] ?? "";
}

export function getMt5CredentialsKeyCandidates() {
  const keys = [
    sanitizeEnvValue(process.env.MT5_CREDENTIALS_KEY),
    sanitizeEnvValue(process.env.MT5_SYNC_SECRET),
    getMt5GatewaySecret(),
    getSupabaseServiceRoleKey(),
  ];
  return keys.filter((key, index) => key && keys.indexOf(key) === index);
}

export function canFetchMt5History() {
  return Boolean(getMt5GatewayUrl() || getMetaApiToken());
}
