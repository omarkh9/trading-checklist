import { DashboardShell } from "@/components/DashboardShell";
import { PreTradeChecklist } from "@/components/pre-trade-checklist/PreTradeChecklist";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Pre-Trade Checklist",
  description:
    "Build session rules and run today's pre-trade checklist in Edge Log by Omar.",
  path: "/pre-trade-checklist",
});

export default function PreTradeChecklistPage() {
  return (
    <DashboardShell
      title="Pre-Trade Checklist"
      description="Build your own rules, then run today's session checklist"
    >
      <PreTradeChecklist />
    </DashboardShell>
  );
}
