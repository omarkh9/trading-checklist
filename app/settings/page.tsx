import { DashboardShell } from "@/components/DashboardShell";
import { SettingsHub } from "@/components/settings/SettingsHub";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Settings",
  description:
    "Manage Edge Log theme, risk guardrails, position sizing, and calendar timezone.",
  path: "/settings",
});

export default function SettingsPage() {
  return (
    <DashboardShell
      title="Settings"
      description="Theme, risk parameters, guardrails, and news timezone"
    >
      <SettingsHub />
    </DashboardShell>
  );
}
