"use client";

import { UserMenu } from "@/components/auth/UserMenu";
import { SessionStatus } from "@/components/dashboard/SessionStatus";
import { Sidebar, SidebarPanel } from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export function DashboardShell({
  children,
  title,
  description,
}: DashboardShellProps) {
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
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,280px)] flex-col border-r border-border bg-surface-raised shadow-xl md:hidden"
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
        <header className="flex h-auto min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-raised/80 px-4 py-3 backdrop-blur-sm sm:px-8 sm:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-zinc-300 transition-colors hover:bg-surface-overlay md:hidden"
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
            <div className="md:hidden">
              <SessionStatus variant="compact" />
            </div>
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
