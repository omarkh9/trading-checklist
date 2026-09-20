import {
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "@/lib/supabase/public-config.mjs";

export function getSupabaseUrl() {
  return resolveSupabaseUrl();
}

export function getSupabaseAnonKey() {
  return resolveSupabaseAnonKey();
}
