import { getAiConfig } from "@/lib/ai/env";
import { ARABIC_VOICE_LANGS } from "@/lib/trades/voice-lang";

export const VOICE_TRANSCRIBE_PROMPT = [
  "Lebanese Arabic (Levantine) dialect, Arabizi, and English mixed together.",
  "If the speaker uses Arabic, transcribe in Arabic script.",
  "If they use Arabizi Latin letters (kifak, shu, yalla, wallah, mashi, 3m, 7elo), keep Arabizi.",
  "Keep English trading terms in English: stop loss, take profit, breakeven, lot size, R:R, pips, long, short, EURUSD, XAUUSD, NAS100.",
  "Do not translate the note. Preserve the speaker's mix of languages.",
].join(" ");

export const BROWSER_VOICE_LANGS = ARABIC_VOICE_LANGS;
export const DEFAULT_BROWSER_VOICE_LANG = ARABIC_VOICE_LANGS[0];

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
