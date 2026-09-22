"use client";

import { AiCoachPanel } from "@/components/ai/AiCoachPanel";
import { useAiDesk } from "@/components/ai/AiDesk";
import { usePathname } from "next/navigation";

export function AiCoachDock() {
  const pathname = usePathname();
  const { coachOpen } = useAiDesk();
  if (pathname === "/coach") return null;

  return (
    <aside
      className={`hidden h-full shrink-0 overflow-hidden border-l border-indigo-400/15 bg-[#0c0c16] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block ${
        coachOpen ? "w-[400px]" : "w-0"
      }`}
      aria-hidden={!coachOpen}
    >
      <div className="h-full w-[400px]">
        <AiCoachPanel variant="dock" />
      </div>
    </aside>
  );
}

export function AiCoachOverlay() {
  const pathname = usePathname();
  const { coachOpen, setCoachOpen } = useAiDesk();
  if (pathname === "/coach") return null;

  if (!coachOpen) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        aria-label="Close coach"
        onClick={() => setCoachOpen(false)}
        className="pointer-events-auto absolute inset-0 bg-black/60"
      />
      <div className="pointer-events-auto absolute inset-y-0 right-0 flex w-[min(100vw,420px)] flex-col border-l border-indigo-400/15 bg-[#0c0c16] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <AiCoachPanel variant="overlay" onClose={() => setCoachOpen(false)} />
      </div>
    </div>
  );
}
