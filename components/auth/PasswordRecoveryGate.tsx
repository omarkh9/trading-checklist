"use client";

import {
  capturePasswordRecovery,
  markPasswordRecovery,
} from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function isUpdatePasswordPath(pathname: string) {
  return pathname.startsWith("/auth/update-password");
}

function isCallbackPath(pathname: string) {
  return pathname.startsWith("/auth/callback");
}

export function PasswordRecoveryGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const goToUpdate = () => {
      markPasswordRecovery();
      if (
        isUpdatePasswordPath(window.location.pathname) ||
        isCallbackPath(window.location.pathname)
      ) {
        return;
      }
      router.replace("/auth/update-password");
    };

    if (capturePasswordRecovery()) {
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
