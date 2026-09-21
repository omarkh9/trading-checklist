import { AuthForm } from "@/components/auth/AuthForm";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";

export const metadata = pageMetadata({
  title: "Create an account",
  description:
    "Create an Edge Log by Omar account to start logging your own trades and checklists.",
  path: "/signup",
});

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
