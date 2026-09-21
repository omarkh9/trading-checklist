import {
  THEME_STORAGE_KEY,
  WORKSPACE_SETTINGS_STORAGE_KEY,
} from "@/lib/storage/keys";
import { getUserTimeZone } from "@/lib/time";
import {
  AUTO_TIME_ZONE,
  defaultWorkspaceSettings,
  type NewsImpactFilter,
  type ThemeMode,
  type WorkspaceSettings,
} from "@/lib/types/settings";

function clampPercent(value: unknown, fallback: number): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.min(100, numeric);
}

function parseTheme(value: unknown): ThemeMode {
  return value === "light" ? "light" : "dark";
}

function parseNewsImpact(value: unknown): NewsImpactFilter {
  if (value === "high" || value === "medium" || value === "all") return value;
  return "all";
}

export function normalizeWorkspaceSettings(
  value: Partial<WorkspaceSettings> | null | undefined
): WorkspaceSettings {
  const defaults = defaultWorkspaceSettings();
  return {
    theme: parseTheme(value?.theme),
    defaultRiskPercent: clampPercent(
      value?.defaultRiskPercent,
      defaults.defaultRiskPercent
    ),
    maxRiskPercent: clampPercent(
      value?.maxRiskPercent,
      defaults.maxRiskPercent
    ),
    dailyLossLimitPercent: clampPercent(
      value?.dailyLossLimitPercent,
      defaults.dailyLossLimitPercent
    ),
    timeZone:
      typeof value?.timeZone === "string" && value.timeZone.trim()
        ? value.timeZone.trim()
        : defaults.timeZone,
    newsImpact: parseNewsImpact(value?.newsImpact),
  };
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return defaultWorkspaceSettings();
  try {
    const raw = localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Partial<WorkspaceSettings>)
      : {};
    const themeRaw = localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeWorkspaceSettings({
      ...parsed,
      theme: parseTheme(themeRaw ?? parsed.theme),
    });
  } catch {
    return defaultWorkspaceSettings();
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === "undefined") return;
  const next = normalizeWorkspaceSettings(settings);
  localStorage.setItem(WORKSPACE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(THEME_STORAGE_KEY, next.theme);
}

export function applyThemeClass(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

export function resolveDisplayTimeZone(timeZone: string): string {
  if (!timeZone || timeZone === AUTO_TIME_ZONE) return getUserTimeZone();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return getUserTimeZone();
  }
}

export function listTimeZones(): string[] {
  const intlWithZones = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof intlWithZones.supportedValuesOf === "function") {
    try {
      return intlWithZones.supportedValuesOf("timeZone");
    } catch {
      // Fall through to a compact curated list.
    }
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Asia/Dubai",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var light=t==="light";var r=document.documentElement;r.classList.toggle("dark",!light);r.classList.toggle("light",light);r.style.colorScheme=light?"light":"dark";}catch(e){}})();`;
