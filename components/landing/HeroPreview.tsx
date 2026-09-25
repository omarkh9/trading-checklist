export function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-indigo-400/30 bg-[#0c0c16] shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_40px_rgba(99,102,241,0.16)] ring-1 ring-white/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400" />
        <video
          className="block aspect-video w-full bg-[#0c0c16] object-cover"
          src="/preview.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label="Edge Log product preview"
        />
      </div>
    </div>
  );
}
