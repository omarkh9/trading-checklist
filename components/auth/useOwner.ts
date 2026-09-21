"use client";

import { isOwnerUser } from "@/lib/owner";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type OwnerState = {
  loading: boolean;
  email: string | null;
  isOwner: boolean;
};

const idleState: OwnerState = {
  loading: true,
  email: null,
  isOwner: false,
};

export function useOwner() {
  const [state, setState] = useState<OwnerState>(idleState);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      setState({
        loading: false,
        email: user?.email ?? null,
        isOwner: isOwnerUser(user),
      });
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
