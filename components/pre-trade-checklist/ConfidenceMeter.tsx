"use client";

import { DeskCard } from "@/components/ui/DeskCard";
import { desk } from "@/lib/ui/desk";

type ConfidenceMeterProps = {
  checklistProgress: number;
  executionConfidence: number;
  onConfidenceChange: (value: number) => void;
  allRulesMet: boolean;
  sessionLabel?: string;
};

function getConfidenceColor(value: number) {
  if (value >= 80) return { stroke: "#34d399", glow: "rgba(16,185,129,0.35)", text: "text-emerald-300" };
  if (value >= 50) return { stroke: "#818cf8", glow: "rgba(99,102,241,0.32)", text: "text-indigo-300" };
  return { stroke: "#fb7185", glow: "rgba(244,63,94,0.28)", text: "text-rose-300" };
}

function getConfidenceLabel(value: number, allRulesMet: boolean) {
  if (!allRulesMet) return "Complete all rules to proceed";
  if (value >= 80) return "High conviction — ready to execute";
  if (value >= 50) return "Moderate confidence — review once more";
  return "Low confidence — consider passing";
}

function ProgressRing({
  value,
  size,
  stroke,
  glow,
  track = "#1a1a2e",
}: {
  value: number;
  size: number;
  stroke: string;
  glow: string;
  track?: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <svg
      className="-rotate-90"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
    >
      <circle cx="50" cy="50" r={radius} fill="none" stroke={track} strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
}

export function ConfidenceMeter({
  checklistProgress,
  executionConfidence,
  onConfidenceChange,
  allRulesMet,
  sessionLabel,
}: ConfidenceMeterProps) {
  const combinedScore = allRulesMet
    ? Math.round((checklistProgress + executionConfidence) / 2)
    : checklistProgress;

  const { stroke, glow, text } = getConfidenceColor(combinedScore);
  const complete = allRulesMet && combinedScore >= 80;

  return (
    <DeskCard
      className={
        complete
          ? "shadow-[0_0_28px_rgba(16,185,129,0.16)]"
          : ""
      }
    >
      <h3 className={desk.title}>Session readiness</h3>
      <p className={desk.subtitle}>
        {sessionLabel
          ? `${sessionLabel} — checklist progress plus your conviction`
          : "Combined readiness from checklist and self-assessment"}
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-around">
        <div className="relative flex h-44 w-44 shrink-0 items-center justify-center">
          <ProgressRing
            value={combinedScore}
            size={176}
            stroke={stroke}
            glow={glow}
          />
          <div className="absolute text-center">
            <p className={`text-4xl font-bold tracking-tight ${text}`}>
              {combinedScore}%
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Confidence
            </p>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-400">Checklist Progress</span>
              <span className="font-medium tabular-nums text-zinc-200">
                {checklistProgress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.45)] transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <label htmlFor="confidence-slider" className="text-zinc-400">
                Self-Assessed Confidence
              </label>
              <span className="font-medium tabular-nums text-zinc-200">
                {executionConfidence}%
              </span>
            </div>
            <input
              id="confidence-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={executionConfidence}
              onChange={(e) => onConfidenceChange(Number(e.target.value))}
              className="w-full accent-indigo-400"
            />
          </div>

          <p
            className={`text-sm ${
              allRulesMet
                ? complete
                  ? "text-emerald-300"
                  : "text-zinc-400"
                : "text-amber-300/90"
            }`}
          >
            {getConfidenceLabel(combinedScore, allRulesMet)}
          </p>
        </div>
      </div>
    </DeskCard>
  );
}
