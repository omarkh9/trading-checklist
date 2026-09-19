import { DashboardShell } from "@/components/DashboardShell";
import { PreTradeChecklist } from "@/components/pre-trade-checklist/PreTradeChecklist";

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
