"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, X } from "lucide-react";
import { navItems } from "@/lib/navigation";

type SessionStatusProps = {
  variant?: "full" | "compact";
};

export function SessionStatus({ variant = "full" }: SessionStatusProps) {
  if (variant === "compact") {
    return (
      <div
        className="flex items-center gap-2 rounded-lg bg-surface-overlay px-2.5 py-1.5 ring-1 ring-border"
        aria-label="Session status: Markets Open"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-zinc-300">Markets Open</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface-overlay p-3 ring-1 ring-border">
      <p className="text-xs font-medium text-zinc-400">Session Status</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm text-zinc-300">Markets Open</span>
      </div>
    </div>
  );
}

type SidebarPanelProps = {
  onNavigate?: () => void;
  onClose?: () => void;
};

export function SidebarPanel({ onNavigate, onClose }: SidebarPanelProps) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 ring-1 ring-accent/30">
          <Activity className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Trading
          </p>
          <h1 className="text-lg font-bold tracking-tight text-gradient">
            EDGE LOG
          </h1>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-surface-overlay hover:text-zinc-100 md:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-accent/15 text-white ring-1 ring-accent/30"
                  : "text-zinc-400 hover:bg-surface-overlay hover:text-zinc-100"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-accent-hover"
                    : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-4">
        <SessionStatus />
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-surface-raised md:flex md:flex-col">
      <SidebarPanel />
    </aside>
  );
}
