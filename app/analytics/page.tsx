import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { DashboardShell } from "@/components/DashboardShell";

export default function AnalyticsPage() {
  return (
    <DashboardShell
      title="Analytics"
      description="Dark-terminal equity curves, setup bars, and live risk stats"
    >
      <AnalyticsDashboard />
    </DashboardShell>
  );
}
