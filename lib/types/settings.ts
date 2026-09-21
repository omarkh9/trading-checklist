export type ThemeMode = "dark" | "light";
export type NewsImpactFilter = "all" | "high" | "medium";

export type WorkspaceSettings = {
  theme: ThemeMode;
  defaultRiskPercent: number;
  maxRiskPercent: number;
  dailyLossLimitPercent: number;
  timeZone: string;
  newsImpact: NewsImpactFilter;
};

export const AUTO_TIME_ZONE = "auto";

export const defaultWorkspaceSettings = (): WorkspaceSettings => ({
  theme: "dark",
  defaultRiskPercent: 1,
  maxRiskPercent: 2,
  dailyLossLimitPercent: 3,
  timeZone: AUTO_TIME_ZONE,
  newsImpact: "all",
});
