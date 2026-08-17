"use client";

type ConfidenceMeterProps = {
  checklistProgress: number;
  executionConfidence: number;
  onConfidenceChange: (value: number) => void;
  allRulesMet: boolean;
};

function getConfidenceColor(value: number) {
  if (value >= 80) return { stroke: "#34d399", text: "text-emerald-400" };
  if (value >= 50) return { stroke: "#6366f1", text: "text-accent-hover" };
  return { stroke: "#f87171", text: "text-red-400" };
}

function getConfidenceLabel(value: number, allRulesMet: boolean) {
  if (!allRulesMet) return "Complete all rules to proceed";
  if (value >= 80) return "High conviction — ready to execute";
  if (value >= 50) return "Moderate confidence — review once more";
  return "Low confidence — consider passing";
}

export function ConfidenceMeter({
  checklistProgress,
  executionConfidence,
  onConfidenceChange,
  allRulesMet,
}: ConfidenceMeterProps) {
  const combinedScore = allRulesMet
    ? Math.round((checklistProgress + executionConfidence) / 2)
    : checklistProgress;

  const { stroke, text } = getConfidenceColor(combinedScore);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (combinedScore / 100) * circumference;

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-6">
      <h3 className="text-lg font-semibold text-zinc-100">
        Execution Confidence
      </h3>
      <p className="mt-1 text-sm text-zinc-500">
        Combined readiness from checklist and self-assessment
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-around">
        <div className="relative flex h-44 w-44 shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#1a1a24"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <p className={`text-4xl font-bold ${text}`}>{combinedScore}%</p>
            <p className="text-xs text-zinc-500">Confidence</p>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-400">Checklist Progress</span>
              <span className="font-medium text-zinc-200">
                {checklistProgress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-overlay">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <label htmlFor="confidence-slider" className="text-zinc-400">
                Self-Assessed Confidence
              </label>
              <span className="font-medium text-zinc-200">
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
              className="w-full accent-accent"
            />
          </div>

          <p
            className={`text-sm ${allRulesMet ? "text-zinc-400" : "text-amber-400/90"}`}
          >
            {getConfidenceLabel(combinedScore, allRulesMet)}
          </p>
        </div>
      </div>
    </div>
  );
}
