import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { DashboardShell } from "@/components/DashboardShell";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Analytics",
  description:
    "Review equity curves, setup performance, and risk stats in Edge Log by Omar.",
  path: "/analytics",
});

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
