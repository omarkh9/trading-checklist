import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { DashboardShell } from "@/components/DashboardShell";

export default function AnalyticsPage() {
  return (
    <DashboardShell
      title="Analytics"
      description="Live P/L, setup performance, and risk statistics from your journal"
    >
      <AnalyticsDashboard />
    </DashboardShell>
  );
}
