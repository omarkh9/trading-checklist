import { DashboardShell } from "@/components/DashboardShell";
import { TradeJournal } from "@/components/trade-journal/TradeJournal";

export default function TradeJournalPage() {
  return (
    <DashboardShell
      title="Trade Journal"
      description="Log setups with glowing inputs, asset badges, and live P/L summaries"
    >
      <TradeJournal />
    </DashboardShell>
  );
}
