import { TradeCalendar } from "@/components/calendar/TradeCalendar";
import { DashboardShell } from "@/components/DashboardShell";

export default function CalendarPage() {
  return (
    <DashboardShell
      title="Calendar"
      description="Review daily net P/L, trade count, and win rate"
    >
      <TradeCalendar />
    </DashboardShell>
  );
}
