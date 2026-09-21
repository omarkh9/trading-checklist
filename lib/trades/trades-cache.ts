import type { Trade } from "@/lib/types/trade";

export type TradesCacheSnapshot = {
  trades: Trade[];
  isLoaded: boolean;
  error: string | null;
};

const EMPTY_SNAPSHOT: TradesCacheSnapshot = {
  trades: [],
  isLoaded: false,
  error: null,
};

let snapshot: TradesCacheSnapshot = EMPTY_SNAPSHOT;
let inflight: Promise<Trade[]> | null = null;
let mutatedDuringFetch = false;
const deletedDuringFetch = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function replaceSnapshot(next: TradesCacheSnapshot) {
  snapshot = next;
  emit();
}

export function subscribeTradesCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTradesCacheSnapshot() {
  return snapshot;
}

export function getServerTradesCacheSnapshot(): TradesCacheSnapshot {
  return EMPTY_SNAPSHOT;
}

export function getCachedTrades() {
  return snapshot.isLoaded ? snapshot.trades : null;
}

export function clearTradesCache() {
  snapshot = EMPTY_SNAPSHOT;
  inflight = null;
  mutatedDuringFetch = false;
  deletedDuringFetch.clear();
  emit();
}

export function setTradesCache(trades: Trade[], error: string | null = null) {
  if (mutatedDuringFetch) {
    const byId = new Map(trades.map((trade) => [trade.id, trade] as const));
    for (const id of deletedDuringFetch) {
      byId.delete(id);
    }
    for (const local of snapshot.trades) {
      if (!deletedDuringFetch.has(local.id)) {
        byId.set(local.id, local);
      }
    }
    trades = [...byId.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    mutatedDuringFetch = false;
    deletedDuringFetch.clear();
  }

  replaceSnapshot({ trades, isLoaded: true, error });
}

export function upsertTradeInCache(trade: Trade) {
  if (inflight) mutatedDuringFetch = true;
  replaceSnapshot({
    trades: [trade, ...snapshot.trades.filter((item) => item.id !== trade.id)],
    isLoaded: snapshot.isLoaded,
    error: null,
  });
}

export function removeTradesFromCache(ids: string[]) {
  if (ids.length === 0) return;
  if (inflight) {
    mutatedDuringFetch = true;
    for (const id of ids) deletedDuringFetch.add(id);
  }
  const idSet = new Set(ids);
  replaceSnapshot({
    trades: snapshot.trades.filter((trade) => !idSet.has(trade.id)),
    isLoaded: snapshot.isLoaded,
    error: null,
  });
}

export async function loadTradesCache(
  loader: () => Promise<Trade[]>,
  force = false
): Promise<Trade[]> {
  if (!force && snapshot.isLoaded && !snapshot.error) {
    return snapshot.trades;
  }
  if (inflight) return inflight;

  inflight = loader()
    .then((trades) => {
      setTradesCache(trades);
      return snapshot.trades;
    })
    .catch((cause) => {
      const message =
        cause instanceof Error ? cause.message : "Could not load trades.";
      replaceSnapshot({
        trades: snapshot.trades,
        isLoaded: true,
        error: message,
      });
      throw cause;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
