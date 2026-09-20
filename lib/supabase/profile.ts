import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type ProfileClient = SupabaseClient<Database>;

export function usernameFromEmail(email: string | null | undefined) {
  const local = (email ?? "trader").split("@")[0] ?? "trader";
  let username = local.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_");
  username = username.replace(/^_+|_+$/g, "");
  if (username.length < 3) username = `${username}_trader`;
  return username.slice(0, 24);
}

export async function ensureUserProfile(
  supabase: ProfileClient,
  user: { id: string; email?: string | null }
) {
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) return;

    const base = usernameFromEmail(user.email);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
      const username = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        username,
      });
      if (!error) return;
      const duplicate =
        error.message.toLowerCase().includes("duplicate") ||
        error.message.toLowerCase().includes("unique");
      if (!duplicate) return;
    }
  } catch {
    // Journal data is keyed by auth.uid(); a missing profile should not block sign-in.
  }
}
