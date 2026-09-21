export type TradeEmotion =
  | "focused"
  | "confident"
  | "calm"
  | "anxious"
  | "greedy"
  | "fearful"
  | "fomo"
  | "satisfied"
  | "angry"
  | "disappointed"
  | "relieved"
  | "tilted";

export type EmotionOption = {
  id: TradeEmotion;
  label: string;
  emoji: string;
};

export const TRADE_EMOTIONS: EmotionOption[] = [
  { id: "focused", label: "Focused", emoji: "🎯" },
  { id: "confident", label: "Confident", emoji: "😎" },
  { id: "calm", label: "Calm", emoji: "😌" },
  { id: "anxious", label: "Anxious", emoji: "😰" },
  { id: "greedy", label: "Greedy", emoji: "🤑" },
  { id: "fearful", label: "Fearful", emoji: "😨" },
  { id: "fomo", label: "FOMO", emoji: "😬" },
  { id: "satisfied", label: "Satisfied", emoji: "😊" },
  { id: "angry", label: "Angry", emoji: "😠" },
  { id: "disappointed", label: "Disappointed", emoji: "😞" },
  { id: "relieved", label: "Relieved", emoji: "😮‍💨" },
  { id: "tilted", label: "Tilted", emoji: "🤯" },
];

const EMOTION_IDS = new Set<string>(TRADE_EMOTIONS.map((item) => item.id));

export function isTradeEmotion(value: unknown): value is TradeEmotion {
  return typeof value === "string" && EMOTION_IDS.has(value);
}

export function emotionLabel(id: TradeEmotion | null | undefined): string {
  if (!id) return "—";
  return TRADE_EMOTIONS.find((item) => item.id === id)?.label ?? "—";
}

export function emotionEmoji(id: TradeEmotion | null | undefined): string {
  if (!id) return "";
  return TRADE_EMOTIONS.find((item) => item.id === id)?.emoji ?? "";
}
