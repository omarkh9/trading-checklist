"use client";

import { AccountProvider } from "@/components/accounts/AccountProvider";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";
import { AiCoachDock, AiCoachOverlay } from "@/components/ai/AiCoachChrome";
import { AiDeskProvider, useAiDesk } from "@/components/ai/AiDesk";
import { AiSupportWidget, SupportHeaderButton } from "@/components/ai/AiSupportWidget";
import { UserMenu } from "@/components/auth/UserMenu";
import { Sidebar, SidebarPanel } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/workspace/ThemeToggle";
import { Menu, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

function CoachHeaderButton() {
  const pathname = usePathname();
  const { coachOpen, toggleCoach } = useAiDesk();
  if (pathname === "/coach") return null;

  return (
    <button
      type="button"
      onClick={toggleCoach}
      aria-pressed={coachOpen}
      className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all duration-300 ${
        coachOpen
          ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-100"
          : "border-white/10 bg-white/5 text-zinc-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
      }`}
    >
      <Sparkles className="h-4 w-4" />
      <span className="hidden sm:inline">Coach</span>
    </button>
  );
}

function DashboardFrame({
  children,
  title,
  description,
}: DashboardShellProps) {
  const pathname = usePathname();
  const isCoach = pathname === "/coach";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-surface">
      <Sidebar />

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,280px)] flex-col border-r border-indigo-400/15 bg-[#0c0c16] shadow-[0_20px_60px_rgba(0,0,0,0.55)] md:hidden"
            aria-label="Mobile navigation"
          >
            <SidebarPanel
              onNavigate={() => setMobileMenuOpen(false)}
              onClose={() => setMobileMenuOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-auto min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 overflow-visible border-b border-indigo-400/15 bg-[#0c0c16]/85 px-4 py-3 backdrop-blur-sm sm:px-8 sm:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
                {title}
              </h2>
              {description && (
                <p className="truncate text-sm text-zinc-500">{description}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <CoachHeaderButton />
            <SupportHeaderButton />
            <AccountSwitcher />
            <ThemeToggle />
            <div className="md:hidden">
              <UserMenu />
            </div>
          </div>
        </header>

        <main
          className={`desk-atmosphere min-w-0 flex-1 ${
            isCoach
              ? "flex flex-col overflow-hidden p-0"
              : "overflow-x-hidden overflow-y-auto p-4 sm:p-8"
          }`}
        >
          {children}
        </main>
      </div>

      <AiCoachDock />
      <AiCoachOverlay />
      <AiSupportWidget />
    </div>
  );
}

export function DashboardShell({
  children,
  title,
  description,
}: DashboardShellProps) {
  return (
    <AccountProvider>
      <AiDeskProvider>
        <DashboardFrame title={title} description={description}>
          {children}
        </DashboardFrame>
      </AiDeskProvider>
    </AccountProvider>
  );
}
