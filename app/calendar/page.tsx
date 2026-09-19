import { TradeCalendar } from "@/components/calendar/TradeCalendar";
import { DashboardShell } from "@/components/DashboardShell";

export default function CalendarPage() {
  return (
    <DashboardShell
      title="Calendar"
      description="Color-coded days with net P/L, trade count, and win rate"
    >
      <TradeCalendar />
    </DashboardShell>
  );
}
