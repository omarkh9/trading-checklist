"use client";

import {
  hasPasswordRecoveryFlag,
  markPasswordRecovery,
} from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function isRecoverySurface(pathname: string) {
  return (
    pathname.startsWith("/auth/update-password") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  );
}

export function PasswordRecoveryGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const goToUpdate = () => {
      markPasswordRecovery();
      if (!isRecoverySurface(window.location.pathname)) {
        router.replace("/auth/update-password");
      }
    };

    if (hasPasswordRecoveryFlag()) {
      goToUpdate();
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        goToUpdate();
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
