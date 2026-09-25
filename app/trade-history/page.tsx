import { DashboardShell } from "@/components/DashboardShell";
import { TradeHistoryView } from "@/components/trade-journal/TradeHistoryView";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Trade History",
  description:
    "Review past trades by asset, direction, and outcome in Edge Log by Owz.",
  path: "/trade-history",
});

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
