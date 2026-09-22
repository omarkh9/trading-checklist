import { AuthCallback } from "@/components/auth/AuthCallback";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";

export const metadata = pageMetadata({
  title: "Confirming email",
  description: "Finish signing in to Edge Log by Omar after confirming your email.",
  path: "/auth/callback",
  index: false,
});

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-24 w-full max-w-md animate-pulse rounded-xl bg-surface-raised" />
        </div>
      }
    >
      <AuthCallback />
    </Suspense>
  );
}
