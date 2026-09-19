import { AuthForm } from "@/components/auth/AuthForm";
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-64 w-full max-w-md animate-pulse rounded-xl bg-surface-raised" />
        </div>
      }
    >
      <AuthForm mode="signup" />
    </Suspense>
  );
}
