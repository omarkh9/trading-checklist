import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { DashboardShell } from "@/components/DashboardShell";

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
