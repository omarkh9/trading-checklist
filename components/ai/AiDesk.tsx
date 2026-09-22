"use client";

import { useAccounts } from "@/components/accounts/AccountProvider";
import { useChatStream } from "@/components/ai/useChatStream";
import { navItems } from "@/lib/navigation";
import { pageLabelForPath } from "@/lib/ai/prompts";
import type { AiClientContext } from "@/lib/ai/types";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ChatApi = ReturnType<typeof useChatStream>;

type AiDeskValue = {
  coachOpen: boolean;
  supportOpen: boolean;
  setCoachOpen: (open: boolean) => void;
  setSupportOpen: (open: boolean) => void;
  toggleCoach: () => void;
  toggleSupport: () => void;
  context: AiClientContext;
  coach: ChatApi;
  support: ChatApi;
};

const AiDeskContext = createContext<AiDeskValue | null>(null);

export function useAiDesk() {
  const value = useContext(AiDeskContext);
  if (!value) {
    throw new Error("useAiDesk must be used inside AiDeskProvider");
  }
  return value;
}

export function AiDeskProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeAccount } = useAccounts();
  const [coachOpen, setCoachOpenState] = useState(false);
  const [supportOpen, setSupportOpenState] = useState(false);

  const pageTitle =
    navItems.find((item) =>
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href)
    )?.label ?? pageLabelForPath(pathname);

  const context = useMemo<AiClientContext>(
    () => ({
      pathname,
      pageTitle,
      accountName: activeAccount?.name,
      accountId: activeAccount?.id,
    }),
    [pathname, pageTitle, activeAccount?.name, activeAccount?.id]
  );

  const coach = useChatStream("coach", context);
  const support = useChatStream("support", context);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCoachOpenState(false);
        setSupportOpenState(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setCoachOpen = useCallback((open: boolean) => {
    setCoachOpenState(open);
    if (open) setSupportOpenState(false);
  }, []);

  const setSupportOpen = useCallback((open: boolean) => {
    setSupportOpenState(open);
    if (open) setCoachOpenState(false);
  }, []);

  const value = useMemo<AiDeskValue>(
    () => ({
      coachOpen,
      supportOpen,
      setCoachOpen,
      setSupportOpen,
      toggleCoach: () => setCoachOpen(!coachOpen),
      toggleSupport: () => setSupportOpen(!supportOpen),
      context,
      coach,
      support,
    }),
    [coachOpen, supportOpen, setCoachOpen, setSupportOpen, context, coach, support]
  );

  return <AiDeskContext.Provider value={value}>{children}</AiDeskContext.Provider>;
}
