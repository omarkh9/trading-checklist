import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { DashboardShell } from "@/components/DashboardShell";

export default function DashboardPage() {
  return (
    <DashboardShell
      title="Dashboard"
      description="Overview of your trading performance and activity"
    >
      <DashboardHome />
    </DashboardShell>
  );
}
