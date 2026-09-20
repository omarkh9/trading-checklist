import {
  emptyChecklistSession,
  localDateKey,
  type ChecklistRule,
  type ChecklistSession,
  type ChecklistSnapshot,
} from "@/lib/types/checklist";

export type ChecklistCacheSnapshot = ChecklistSnapshot & {
  isLoaded: boolean;
  error: string | null;
};

const EMPTY_SNAPSHOT: ChecklistCacheSnapshot = {
  rules: [],
  session: emptyChecklistSession(""),
  isLoaded: false,
  error: null,
};

let snapshot: ChecklistCacheSnapshot = EMPTY_SNAPSHOT;
let inflight: Promise<ChecklistSnapshot> | null = null;
let mutatedDuringFetch = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function replaceSnapshot(next: ChecklistCacheSnapshot) {
  snapshot = next;
  emit();
}

export function subscribeChecklistCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getChecklistCacheSnapshot() {
  return snapshot;
}

export function getServerChecklistCacheSnapshot(): ChecklistCacheSnapshot {
  return EMPTY_SNAPSHOT;
}

export function getCachedChecklistSnapshot() {
  return snapshot.isLoaded ? snapshot : null;
}

export function clearChecklistCache() {
  snapshot = EMPTY_SNAPSHOT;
  inflight = null;
  mutatedDuringFetch = false;
  emit();
}

export function setChecklistCache(
  next: ChecklistSnapshot,
  error: string | null = null
) {
  if (mutatedDuringFetch) {
    next = {
      rules: snapshot.rules.length > 0 ? snapshot.rules : next.rules,
      session: snapshot.session.date ? snapshot.session : next.session,
    };
    mutatedDuringFetch = false;
  }
  replaceSnapshot({ ...next, isLoaded: true, error });
}

export function patchChecklistCache(
  patch: Partial<Pick<ChecklistCacheSnapshot, "rules" | "session">>
) {
  if (inflight) mutatedDuringFetch = true;
  replaceSnapshot({
    ...snapshot,
    ...patch,
    error: null,
  });
}

export async function loadChecklistCache(
  loader: () => Promise<ChecklistSnapshot>,
  date = localDateKey(),
  force = false
): Promise<ChecklistSnapshot> {
  if (
    !force &&
    snapshot.isLoaded &&
    !snapshot.error &&
    snapshot.session.date === date
  ) {
    return snapshot;
  }
  if (inflight) return inflight;

  inflight = loader()
    .then((next) => {
      setChecklistCache(next);
      return { rules: snapshot.rules, session: snapshot.session };
    })
    .catch((cause) => {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not load your checklist.";
      replaceSnapshot({
        ...snapshot,
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
