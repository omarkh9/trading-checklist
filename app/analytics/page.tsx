import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { DashboardShell } from "@/components/DashboardShell";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Analytics",
  description:
    "Advanced AI analytics for Edge Log by Owz: win rates, session leaks, risk discipline, and behavioral audits.",
  path: "/analytics",
});

export default function AnalyticsPage() {
  return (
    <DashboardShell
      title="Analytics"
      description="Win rates, session leaks, risk discipline, and automated behavioral audits"
    >
      <AnalyticsDashboard />
    </DashboardShell>
  );
}
