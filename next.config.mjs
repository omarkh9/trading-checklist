import {
  resolveOwnerEmail,
  resolveSiteUrl,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "./lib/supabase/public-config.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: resolveSupabaseUrl(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKey(),
    NEXT_PUBLIC_OWNER_EMAIL: resolveOwnerEmail(),
    NEXT_PUBLIC_SITE_URL: resolveSiteUrl(),
  },
};

export default nextConfig;
