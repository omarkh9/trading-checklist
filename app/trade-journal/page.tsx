import { DashboardShell } from "@/components/DashboardShell";
import { TradeJournal } from "@/components/trade-journal/TradeJournal";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Trade Journal",
  description:
    "Log trade setups, screenshots, and live P/L in Edge Log by Omar.",
  path: "/trade-journal",
});

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
