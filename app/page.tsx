import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { DashboardShell } from "@/components/DashboardShell";
import { SITE_DESCRIPTION, SITE_NAME, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

export default function DashboardPage() {
  return (
    <DashboardShell
      title="Dashboard"
      description="Your edge at a glance — performance, flow, and readiness"
    >
      <DashboardHome />
    </DashboardShell>
  );
}
