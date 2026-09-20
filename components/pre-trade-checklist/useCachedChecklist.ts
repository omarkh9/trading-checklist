"use client";

import { fetchChecklistSnapshot } from "@/lib/supabase/checklist";
import {
  getChecklistCacheSnapshot,
  getServerChecklistCacheSnapshot,
  subscribeChecklistCache,
} from "@/lib/checklist/checklist-cache";
import { useEffect, useSyncExternalStore } from "react";

export function useCachedChecklist() {
  const snapshot = useSyncExternalStore(
    subscribeChecklistCache,
    getChecklistCacheSnapshot,
    getServerChecklistCacheSnapshot
  );

  useEffect(() => {
    void fetchChecklistSnapshot().catch(() => {
      // Error is stored on the shared snapshot.
    });
  }, []);

  return snapshot;
}
