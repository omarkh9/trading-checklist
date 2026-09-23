import { getAiConfig } from "@/lib/ai/env";

export const VOICE_TRANSCRIBE_PROMPT = [
  "English trading journal note.",
  "Keep English trading terms in English: stop loss, take profit, breakeven, lot size, R:R, pips, long, short, EURUSD, XAUUSD, NAS100.",
  "Do not translate the note.",
].join(" ");

export const BROWSER_VOICE_LANGS = ["en-US", "en-GB"] as const;
export const DEFAULT_BROWSER_VOICE_LANG = "en-US";

export function getTranscribeModel() {
  return (
    process.env.OPENAI_TRANSCRIBE_MODEL ||
    process.env.AI_TRANSCRIBE_MODEL ||
    "whisper-1"
  ).trim();
}

export function getTranscribeConfig() {
  const ai = getAiConfig();
  return {
    ...ai,
    model: getTranscribeModel(),
  };
}
