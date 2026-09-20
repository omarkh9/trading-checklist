import { fetchChecklistSnapshot } from "@/lib/supabase/checklist";
import { fetchTrades } from "@/lib/supabase/trades";

export function prefetchDeskCaches() {
  void fetchTrades().catch(() => {
    // Shared cache records the error.
  });
  void fetchChecklistSnapshot().catch(() => {
    // Shared cache records the error.
  });
}
