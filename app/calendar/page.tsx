import { TradeCalendar } from "@/components/calendar/TradeCalendar";
import { DashboardShell } from "@/components/DashboardShell";

export default function CalendarPage() {
  return (
    <DashboardShell
      title="Calendar"
      description="Review trades by day across the month"
    >
      <TradeCalendar />
    </DashboardShell>
  );
}
