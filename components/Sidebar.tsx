"use client";

import { UserMenu } from "@/components/auth/UserMenu";
import { useOwner } from "@/components/auth/useOwner";
import { CompactMarketClock } from "@/components/dashboard/CompactMarketClock";
import { navItems } from "@/lib/navigation";
import { Activity, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarPanelProps = {
  onNavigate?: () => void;
  onClose?: () => void;
};

export function SidebarPanel({ onNavigate, onClose }: SidebarPanelProps) {
  const pathname = usePathname();
  const { isOwner } = useOwner();
  const primaryItems = navItems.filter((item) => item.href !== "/settings");
  const settingsItem = navItems.find((item) => item.href === "/settings");

  const renderLink = (item: (typeof navItems)[number]) => {
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
        className={`group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
          isActive
            ? "bg-indigo-500/12 text-zinc-50 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.16)]"
            : "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
        }`}
      >
        <span
          className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-400 transition-opacity duration-300 ${
            isActive
              ? "opacity-100 shadow-[0_0_10px_rgba(129,140,248,0.65)]"
              : "opacity-0 group-hover:opacity-40"
          }`}
          aria-hidden
        />
        <Icon
          className={`h-4 w-4 shrink-0 transition-colors duration-300 ${
            isActive
              ? "text-indigo-300"
              : "text-zinc-400 group-hover:text-indigo-200"
          }`}
        />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-indigo-400/15 px-4 sm:px-5">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-lg bg-indigo-500/25 blur-md" />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/35 via-violet-500/20 to-emerald-500/10 ring-1 ring-indigo-400/40 shadow-[0_0_18px_rgba(99,102,241,0.35)]">
            <Activity className="h-5 w-5 text-indigo-200" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            {isOwner ? "Owner desk" : "Trading"}
          </p>
          <h1 className="text-lg font-bold tracking-[0.22em] text-gradient">
            EDGE LOG
          </h1>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-zinc-100 md:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {primaryItems.map(renderLink)}
        <div className="px-0.5 pt-3 pb-2">
          <CompactMarketClock />
        </div>
        {settingsItem ? renderLink(settingsItem) : null}
      </nav>

      <div className="shrink-0 border-t border-indigo-400/15 p-3">
        <UserMenu variant="sidebar" />
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="relative hidden h-full w-64 shrink-0 flex-col overflow-hidden border-r border-indigo-400/15 bg-[#0c0c16] md:flex md:flex-col">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-500/[0.07] via-transparent to-emerald-500/[0.04]" />
      <div className="relative flex h-full flex-col">
        <SidebarPanel />
      </div>
    </aside>
  );
}
