import { VOICE_LANG_STORAGE_KEY } from "@/lib/storage/keys";

export type VoiceLangMode = "ar" | "en";

export const ARABIC_VOICE_LANGS = ["ar-SA", "ar-AE", "ar", "ar-EG"] as const;
export const ENGLISH_VOICE_LANGS = ["en-US", "en-GB"] as const;

export function langsForMode(mode: VoiceLangMode): string[] {
  return mode === "ar" ? [...ARABIC_VOICE_LANGS] : [...ENGLISH_VOICE_LANGS];
}

export function detectDefaultVoiceMode(): VoiceLangMode {
  if (typeof navigator === "undefined") return "en";
  const locales = [navigator.language, ...(navigator.languages ?? [])];
  return locales.some((locale) => locale?.toLowerCase().startsWith("ar"))
    ? "ar"
    : "en";
}

export function readVoiceLangMode(): VoiceLangMode {
  if (typeof window === "undefined") return detectDefaultVoiceMode();
  try {
    const stored = window.localStorage.getItem(VOICE_LANG_STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    // Private mode can block storage.
  }
  return detectDefaultVoiceMode();
}

export function writeVoiceLangMode(mode: VoiceLangMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOICE_LANG_STORAGE_KEY, mode);
  } catch {
    // Ignore persistence failures.
  }
}
