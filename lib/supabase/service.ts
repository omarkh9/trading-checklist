import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey } from "@/lib/mt5/env";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseUrl } from "@/lib/supabase/env";

// Server-only client that bypasses RLS. Null when SUPABASE_SERVICE_ROLE_KEY
// is not configured.
export function createServiceRoleClient() {
  const key = getSupabaseServiceRoleKey();
  if (!key) return null;
  return createClient<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
