"use client";

import {
  applyThemeClass,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
} from "@/lib/settings/workspace";
import {
  defaultWorkspaceSettings,
  type ThemeMode,
  type WorkspaceSettings,
} from "@/lib/types/settings";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type WorkspaceContextValue = {
  settings: WorkspaceSettings;
  isLoaded: boolean;
  setSettings: (patch: Partial<WorkspaceSettings>) => void;
  setTheme: (theme: ThemeMode) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<WorkspaceSettings>(
    defaultWorkspaceSettings
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = loadWorkspaceSettings();
    setSettingsState(loaded);
    applyThemeClass(loaded.theme);
    setIsLoaded(true);
  }, []);

  const persist = useCallback((next: WorkspaceSettings) => {
    setSettingsState(next);
    saveWorkspaceSettings(next);
    applyThemeClass(next.theme);
  }, []);

  const setSettings = useCallback(
    (patch: Partial<WorkspaceSettings>) => {
      persist({ ...settings, ...patch });
    },
    [persist, settings]
  );

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      persist({ ...settings, theme });
    },
    [persist, settings]
  );

  const value = useMemo(
    () => ({ settings, isLoaded, setSettings, setTheme }),
    [isLoaded, setSettings, setTheme, settings]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceSettings() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceSettings must be used within WorkspaceProvider");
  }
  return context;
}
