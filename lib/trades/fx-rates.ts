import { fallbackQuoteToUsd } from "@/lib/trades/assets";

const cache = new Map<string, { rate: number; at: number }>();
const TTL_MS = 15 * 60 * 1000;

function cacheGet(quote: string): number | null {
  const hit = cache.get(quote);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(quote);
    return null;
  }
  return hit.rate;
}

export function cachedQuoteToUsd(quote: string): number | null {
  const code = quote.trim().toUpperCase();
  if (!code) return null;
  if (code === "USD" || code === "USDT" || code === "USDC") return 1;
  return cacheGet(code) ?? fallbackQuoteToUsd(code) ?? null;
}

export async function loadQuoteToUsd(quote: string): Promise<number | null> {
  const code = quote.trim().toUpperCase();
  if (!code) return null;
  if (code === "USD" || code === "USDT" || code === "USDC") return 1;

  const cached = cacheGet(code);
  if (cached != null) return cached;

  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(code)}&to=USD`
    );
    if (response.ok) {
      const data = (await response.json()) as { rates?: { USD?: number } };
      const rate = data.rates?.USD;
      if (rate != null && Number.isFinite(rate) && rate > 0) {
        cache.set(code, { rate, at: Date.now() });
        return rate;
      }
    }
  } catch {
    // Fall through to the static desk rate.
  }

  return fallbackQuoteToUsd(code) ?? null;
}
