import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Update password",
  description: "Set a new password for your Edge Log by Omar account.",
  path: "/auth/update-password",
  index: false,
});

export default function UpdatePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
