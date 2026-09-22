const PAIR_WORDS: Array<[RegExp, string]> = [
  [/\beur\s*usd\b/gi, "EURUSD"],
  [/\bgbp\s*usd\b/gi, "GBPUSD"],
  [/\baud\s*usd\b/gi, "AUDUSD"],
  [/\bnzd\s*usd\b/gi, "NZDUSD"],
  [/\busd\s*cad\b/gi, "USDCAD"],
  [/\busd\s*chf\b/gi, "USDCHF"],
  [/\busd\s*jpy\b/gi, "USDJPY"],
  [/\beur\s*jpy\b/gi, "EURJPY"],
  [/\bgbp\s*jpy\b/gi, "GBPJPY"],
  [/\beur\s*gbp\b/gi, "EURGBP"],
  [/\bxau\s*usd\b/gi, "XAUUSD"],
  [/\bxag\s*usd\b/gi, "XAGUSD"],
  [/\bnas(?:daq)?\s*100\b/gi, "NAS100"],
  [/\bus\s*30\b/gi, "US30"],
  [/\bs(?:and|&)?p\s*500\b/gi, "SPX500"],
];

const TRADING_PHRASES: Array<[RegExp, string]> = [
  [/\b(?:r\s*[\s:/.-]\s*r|are\s+are|risk\s+(?:to\s+)?reward)\b/gi, "R:R"],
  [/\b(?:one|1)\s+r\b/gi, "1R"],
  [/\b(?:two|2)\s+r\b/gi, "2R"],
  [/\b(?:three|3)\s+r\b/gi, "3R"],
  [/\b(?:one|1)\s+to\s+(?:two|2)\b/gi, "1:2"],
  [/\b(?:one|1)\s+to\s+(?:three|3)\b/gi, "1:3"],
  [/\bstop\s+(?:loss|lost|losts)\b/gi, "stop loss"],
  [/\btake\s+profit\b/gi, "take profit"],
  [/\bbreak\s*even\b/gi, "breakeven"],
  [/\bhigher\s+time\s*frame\b/gi, "HTF"],
  [/\bmiddle\s+time\s*frame\b/gi, "MTF"],
  [/\blower\s+time\s*frame\b/gi, "LTF"],
  [/\blot\s+size\b/gi, "lot size"],
  [/\bentry\s+price\b/gi, "entry price"],
  [/\bexit\s+price\b/gi, "exit price"],
];

const TRADING_HINTS =
  /\b(r:r|1r|2r|3r|stop loss|take profit|breakeven|htf|mtf|ltf|pips?|lots?|long|short|eurusd|gbpusd|usdjpy|xauusd)\b/i;

function applyPairs(value: string): string {
  return PAIR_WORDS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

export function correctTradingTranscript(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  let next = applyPairs(trimmed);
  next = TRADING_PHRASES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    next
  );
  return next.replace(/\s+/g, " ").trim();
}

export function scoreTradingTranscript(value: string): number {
  const matches = value.match(new RegExp(TRADING_HINTS.source, "gi"));
  return (matches?.length ?? 0) * 3 + (value.match(/[A-Z]{3,6}/g)?.length ?? 0);
}

export function pickBestTranscript(alternatives: string[]): string {
  const cleaned = alternatives
    .map((item) => correctTradingTranscript(item))
    .filter(Boolean);
  if (cleaned.length === 0) return "";
  return cleaned.reduce((best, current) =>
    scoreTradingTranscript(current) > scoreTradingTranscript(best)
      ? current
      : best
  );
}

export function alreadyCaptured(existing: string, incoming: string): boolean {
  const left = existing.trim().toLowerCase().replace(/\s+/g, " ");
  const right = incoming.trim().toLowerCase().replace(/\s+/g, " ");
  if (!right) return true;
  if (!left) return false;
  return left === right || left.endsWith(` ${right}`);
}

export function appendTranscript(existing: string, incoming: string): string {
  const next = correctTradingTranscript(incoming);
  if (!next) return existing.trim();
  if (alreadyCaptured(existing, next)) return existing.trim();
  return [existing.trim(), next].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

export const TRADING_VOICE_GRAMMAR = `#JSGF V1.0; grammar trading; public <term> = R:R | stop loss | take profit | breakeven | lot size | EURUSD | GBPUSD | USDJPY | XAUUSD | NAS100 | US30 | HTF | MTF | LTF | long | short | pips | 1R | 2R | 3R ;`;
