"use client";

import { useWorkspaceSettings } from "@/components/workspace/WorkspaceProvider";
import { Moon, Sun } from "lucide-react";

type ThemeToggleProps = {
  variant?: "icon" | "segmented";
};

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const { settings, setTheme } = useWorkspaceSettings();
  const isDark = settings.theme === "dark";

  if (variant === "segmented") {
    return (
      <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isDark
              ? "bg-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)]"
              : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <Moon className="h-4 w-4" />
          Dark
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !isDark
              ? "bg-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)]"
              : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <Sun className="h-4 w-4" />
          Light
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
