import { DashboardShell } from "@/components/DashboardShell";
import { TradeHistoryView } from "@/components/trade-journal/TradeHistoryView";

export default function TradeHistoryPage() {
  return (
    <DashboardShell
      title="Trade History"
      description="Tabular history with asset, direction, and outcome badges"
    >
      <TradeHistoryView />
    </DashboardShell>
  );
}
