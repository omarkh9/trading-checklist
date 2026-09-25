import { AuthForm } from "@/components/auth/AuthForm";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";

export const metadata = pageMetadata({
  title: "Sign in",
  description:
    "Sign in to Edge Log by Owz to journal trades, run checklists, and review analytics.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-64 w-full max-w-md animate-pulse rounded-xl bg-surface-raised" />
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
