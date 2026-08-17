import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquare,
  NotebookPen,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Trade Journal",
    href: "/trade-journal",
    icon: NotebookPen,
  },
  {
    label: "Pre-Trade Checklist",
    href: "/pre-trade-checklist",
    icon: ClipboardCheck,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    label: "Community Feed",
    href: "/community-feed",
    icon: MessageSquare,
  },
];
