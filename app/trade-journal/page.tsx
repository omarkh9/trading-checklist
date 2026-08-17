import { DashboardShell } from "@/components/DashboardShell";
import { TradeJournal } from "@/components/trade-journal/TradeJournal";

export default function TradeJournalPage() {
  return (
    <DashboardShell
      title="Trade Journal"
      description="Log, review, and reflect on every trade"
    >
      <TradeJournal />
    </DashboardShell>
  );
}
