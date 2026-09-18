import { DashboardShell } from "@/components/DashboardShell";
import { TradeHistoryView } from "@/components/trade-journal/TradeHistoryView";

export default function TradeHistoryPage() {
  return (
    <DashboardShell
      title="Trade History"
      description="Filter, review, update, or remove logged trades"
    >
      <TradeHistoryView />
    </DashboardShell>
  );
}
