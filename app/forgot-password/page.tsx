import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";

export const metadata = pageMetadata({
  title: "Forgot password",
  description: "Reset your Edge Log by Owz password with a secure email link.",
  path: "/forgot-password",
  index: false,
});

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-64 w-full max-w-md animate-pulse rounded-xl bg-surface-raised" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
