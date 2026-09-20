import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Forgot password",
  description: "Reset your Edge Log by Omar password with a secure email link.",
  path: "/forgot-password",
  index: false,
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
