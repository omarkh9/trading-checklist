const equityPath =
  "M0 92 C 28 88, 42 70, 64 66 S 110 78, 138 52 S 190 28, 228 34 S 280 58, 320 24 S 360 18, 400 12";

const sampleTrades = [
  { pair: "EURUSD", side: "Long", outcome: "Win", pnl: "+$186" },
  { pair: "XAUUSD", side: "Short", outcome: "Win", pnl: "+$94" },
  { pair: "GBPJPY", side: "Long", outcome: "Loss", pnl: "−$42" },
] as const;

export function HeroPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-indigo-400/25 bg-[#0c0c16]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400" />

        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Dashboard preview
          </p>
          <p className="text-[10px] font-medium tracking-[0.18em] text-indigo-300">
            EDGE LOG
          </p>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <PreviewStat label="Win rate" value="62%" tone="text-emerald-300" />
          <PreviewStat label="This week" value="14" tone="text-indigo-200" />
          <PreviewStat label="Avg R:R" value="1.7" tone="text-violet-200" />
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Equity
              </p>
              <p className="font-mono text-xs font-semibold text-emerald-300">
                +$1,240
              </p>
            </div>
            <svg
              className="mt-3 h-24 w-full"
              viewBox="0 0 400 110"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="edge-log-equity-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${equityPath} L400 110 L0 110 Z`}
                fill="url(#edge-log-equity-fill)"
              />
              <path
                d={equityPath}
                stroke="#a5b4fc"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="mt-3 space-y-2">
            {sampleTrades.map((trade) => (
              <div
                key={trade.pair}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                  trade.outcome === "Win"
                    ? "border-emerald-400/20 bg-emerald-500/[0.07]"
                    : "border-rose-400/20 bg-rose-500/[0.07]"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {trade.pair}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {trade.side} · {trade.outcome}
                  </p>
                </div>
                <p
                  className={`font-mono text-sm font-bold tabular-nums ${
                    trade.outcome === "Win"
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {trade.pnl}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${tone}`}>
        {value}
      </p>
    </div>
  );
}
