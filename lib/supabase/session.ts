import { createClient } from "@/lib/supabase/client";

const USER_TTL_MS = 45_000;

let cached:
  | {
      userId: string;
      at: number;
    }
  | null = null;

export async function requireUserSession() {
  const supabase = createClient();
  if (cached && Date.now() - cached.at < USER_TTL_MS) {
    return { supabase, userId: cached.userId };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("You must be signed in.");

  cached = { userId: user.id, at: Date.now() };
  return { supabase, userId: user.id };
}

export function clearUserSessionCache() {
  cached = null;
}
