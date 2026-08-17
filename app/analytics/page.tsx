import { DashboardShell } from "@/components/DashboardShell";

export default function AnalyticsPage() {
  return (
    <DashboardShell
      title="Analytics"
      description="Deep dive into your trading metrics and patterns"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface-raised p-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Performance by Setup
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Win rate and expectancy per strategy
          </p>
          <div className="mt-8 flex h-48 items-end justify-around gap-4">
            {[
              { label: "Breakout", height: "h-32", value: "72%" },
              { label: "Pullback", height: "h-24", value: "58%" },
              { label: "Reversal", height: "h-16", value: "45%" },
              { label: "Scalp", height: "h-28", value: "65%" },
            ].map((bar) => (
              <div key={bar.label} className="flex flex-col items-center gap-2">
                <div
                  className={`w-12 rounded-t-md bg-gradient-to-t from-accent-muted to-accent ${bar.height}`}
                />
                <p className="text-xs text-zinc-500">{bar.label}</p>
                <p className="text-sm font-medium text-zinc-300">{bar.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface-raised p-6">
          <h3 className="text-lg font-semibold text-zinc-100">
            Monthly P&amp;L
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Cumulative performance trend
          </p>
          <div className="mt-8 flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface-overlay/50">
            <p className="text-sm text-zinc-500">
              Chart visualization coming soon
            </p>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
