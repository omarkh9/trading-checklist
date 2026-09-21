import {
  isTradeEmotion,
  type TradeEmotion,
} from "@/lib/types/emotion";

export type JournalMeta = {
  exitPrice: string;
  emotionBefore: TradeEmotion | null;
  emotionAfter: TradeEmotion | null;
  ruleScore: number | null;
  checkedRuleIds: string[];
};

const META_PREFIX = "<!--ELMETA:";
const META_SUFFIX = "-->";
const META_RE = /<!--ELMETA:([\s\S]*?)-->/;

export const emptyJournalMeta = (): JournalMeta => ({
  exitPrice: "",
  emotionBefore: null,
  emotionAfter: null,
  ruleScore: null,
  checkedRuleIds: [],
});

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asScore(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function parseJournalMeta(value: unknown): JournalMeta {
  const empty = emptyJournalMeta();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const record = value as Record<string, unknown>;
  return {
    exitPrice:
      typeof record.exitPrice === "string" ? record.exitPrice : empty.exitPrice,
    emotionBefore: isTradeEmotion(record.emotionBefore)
      ? record.emotionBefore
      : null,
    emotionAfter: isTradeEmotion(record.emotionAfter)
      ? record.emotionAfter
      : null,
    ruleScore: asScore(record.ruleScore),
    checkedRuleIds: asStringArray(record.checkedRuleIds),
  };
}

export function stripJournalMeta(notes: string): string {
  return notes.replace(META_RE, "").replace(/^\n/, "");
}

export function decodeNotesWithMeta(notes: string): {
  notes: string;
  meta: JournalMeta;
} {
  const match = notes.match(META_RE);
  if (!match) {
    return { notes, meta: emptyJournalMeta() };
  }

  try {
    return {
      notes: stripJournalMeta(notes).trimStart(),
      meta: parseJournalMeta(JSON.parse(match[1])),
    };
  } catch {
    return { notes: stripJournalMeta(notes).trimStart(), meta: emptyJournalMeta() };
  }
}

export function encodeNotesWithMeta(notes: string, meta: JournalMeta): string {
  const cleanNotes = stripJournalMeta(notes);
  const payload: JournalMeta = {
    exitPrice: meta.exitPrice ?? "",
    emotionBefore: meta.emotionBefore ?? null,
    emotionAfter: meta.emotionAfter ?? null,
    ruleScore:
      meta.ruleScore == null || !Number.isFinite(meta.ruleScore)
        ? null
        : Math.max(0, Math.min(100, Math.round(meta.ruleScore))),
    checkedRuleIds: Array.isArray(meta.checkedRuleIds)
      ? meta.checkedRuleIds.filter(Boolean)
      : [],
  };

  const hasMeta =
    payload.exitPrice.trim() !== "" ||
    payload.emotionBefore != null ||
    payload.emotionAfter != null ||
    payload.ruleScore != null ||
    payload.checkedRuleIds.length > 0;

  if (!hasMeta) return cleanNotes;
  return `${META_PREFIX}${JSON.stringify(payload)}${META_SUFFIX}${
    cleanNotes ? `\n${cleanNotes}` : ""
  }`;
}
