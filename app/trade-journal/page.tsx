import { DashboardShell } from "@/components/DashboardShell";
import { TradeJournal } from "@/components/trade-journal/TradeJournal";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Trade Journal",
  description:
    "Log setups, screenshots, auto P/L, rule scores, and voice notes in Edge Log by Owz.",
  path: "/trade-journal",
});

export default function TradeJournalPage() {
  return (
    <DashboardShell
      title="Trade Journal"
      description="Split-screen journal with auto P/L, rule scores, and voice notes"
    >
      <TradeJournal />
    </DashboardShell>
  );
}
