import { DashboardShell } from "@/components/DashboardShell";
import { PreTradeChecklist } from "@/components/pre-trade-checklist/PreTradeChecklist";

export default function PreTradeChecklistPage() {
  return (
    <DashboardShell
      title="Pre-Trade Checklist"
      description="Interactive rules with progress rings and glowing completion"
    >
      <PreTradeChecklist />
    </DashboardShell>
  );
}
