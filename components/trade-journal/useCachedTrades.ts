"use client";

import { fetchTrades } from "@/lib/supabase/trades";
import {
  getServerTradesCacheSnapshot,
  getTradesCacheSnapshot,
  subscribeTradesCache,
} from "@/lib/trades/trades-cache";
import { useEffect, useSyncExternalStore } from "react";

export function useCachedTrades() {
  const snapshot = useSyncExternalStore(
    subscribeTradesCache,
    getTradesCacheSnapshot,
    getServerTradesCacheSnapshot
  );

  useEffect(() => {
    void fetchTrades().catch(() => {
      // Error is stored on the shared snapshot.
    });
  }, []);

  return snapshot;
}
