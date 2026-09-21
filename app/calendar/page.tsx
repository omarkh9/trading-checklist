import { TradeCalendar } from "@/components/calendar/TradeCalendar";
import { DashboardShell } from "@/components/DashboardShell";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Calendar",
  description:
    "See daily P/L, trade count, and win rate on the Edge Log by Omar calendar.",
  path: "/calendar",
});

export default function CalendarPage() {
  return (
    <DashboardShell
      title="Calendar"
      description="Color-coded days plus weekly and monthly performance summaries"
    >
      <TradeCalendar />
    </DashboardShell>
  );
}
