import type { AssetClass } from "@/lib/trades/assets";

export const desk = {
  card: "relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-desk/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-indigo-400/35",
  bar: "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400",
  wash: "pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent",
  input:
    "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all duration-300 focus:border-indigo-400/55 focus:bg-indigo-500/5 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.16)]",
  label:
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500",
  title: "text-lg font-semibold tracking-tight text-zinc-50",
  subtitle: "mt-1 text-sm text-zinc-500",
  panel:
    "rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors duration-300",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.28)] transition-all duration-300 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100",
};

export const assetClassBadgeClass: Record<AssetClass, string> = {
  "forex-major": "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
  "forex-minor": "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  "forex-exotic": "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30",
  metal: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  energy: "bg-orange-500/15 text-orange-300 ring-orange-400/30",
  index: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  crypto: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  unknown: "bg-zinc-500/15 text-zinc-400 ring-zinc-400/25",
};
