const equityPath =
  "M0 88 C 26 84, 48 72, 68 64 S 108 74, 136 48 S 188 26, 226 32 S 274 56, 318 22 S 360 16, 400 10";

const trades = [
  { pair: "EURUSD", side: "Long", outcome: "Win", pnl: "+$186", delay: "180ms" },
  { pair: "XAUUSD", side: "Short", outcome: "Win", pnl: "+$94", delay: "320ms" },
  { pair: "GBPJPY", side: "Long", outcome: "Loss", pnl: "−$42", delay: "460ms" },
] as const;

const candles = [
  { h: "h-8", up: true },
  { h: "h-12", up: true },
  { h: "h-6", up: false },
  { h: "h-14", up: true },
  { h: "h-9", up: false },
  { h: "h-16", up: true },
  { h: "h-7", up: true },
  { h: "h-11", up: false },
  { h: "h-13", up: true },
  { h: "h-8", up: true },
] as const;

export function HeroPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 animate-hero-glow rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 animate-hero-glow rounded-full bg-emerald-500/15 blur-3xl [animation-delay:1.2s]" />

      <div className="relative overflow-hidden rounded-2xl border border-indigo-400/30 bg-[#0c0c16]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_40px_rgba(99,102,241,0.16)] ring-1 ring-white/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/5" />

        <div className="relative flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-hero-live rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Live desk
            </p>
          </div>
          <p className="text-[10px] font-medium tracking-[0.18em] text-indigo-300">
            EDGE LOG
          </p>
        </div>

        <div className="relative grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <Metric label="Win rate" value="62%" tone="text-emerald-300" glow="shadow-[0_0_24px_rgba(52,211,153,0.12)]" />
          <Metric label="This week" value="14" tone="text-indigo-200" glow="shadow-[0_0_24px_rgba(129,140,248,0.14)]" />
          <Metric label="Avg R:R" value="1.7" tone="text-violet-200" glow="shadow-[0_0_24px_rgba(167,139,250,0.12)]" />
        </div>

        <div className="relative px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Equity
              </p>
              <p className="animate-hero-glow font-mono text-xs font-semibold text-emerald-300">
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
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                className="animate-hero-fill"
                d={`${equityPath} L400 110 L0 110 Z`}
                fill="url(#edge-log-equity-fill)"
              />
              <path
                className="animate-hero-draw"
                d={equityPath}
                stroke="#a5b4fc"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ strokeDasharray: 520 }}
              />
            </svg>
            <div className="mt-3 flex h-16 items-end justify-between gap-1.5 px-1">
              {candles.map((candle, index) => (
                <span
                  key={`${candle.h}-${index}`}
                  className={`w-full max-w-[14px] rounded-sm ${candle.h} ${
                    candle.up
                      ? "bg-emerald-400/70 shadow-[0_0_10px_rgba(52,211,153,0.25)]"
                      : "bg-rose-400/55"
                  } animate-hero-rise`}
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {trades.map((trade) => (
              <div
                key={trade.pair}
                className={`flex animate-hero-rise items-center justify-between rounded-xl border px-3 py-2.5 ${
                  trade.outcome === "Win"
                    ? "border-emerald-400/20 bg-emerald-500/[0.07]"
                    : "border-rose-400/20 bg-rose-500/[0.07]"
                }`}
                style={{ animationDelay: trade.delay }}
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

function Metric({
  label,
  value,
  tone,
  glow,
}: {
  label: string;
  value: string;
  tone: string;
  glow: string;
}) {
  return (
    <div
      className={`animate-hero-rise rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 ${glow}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 animate-hero-glow text-2xl font-extrabold tracking-tight ${tone}`}>
        {value}
      </p>
    </div>
  );
}
