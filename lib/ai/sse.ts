import type { AiStreamEvent } from "@/lib/ai/types";

export function parseSseFrames(chunk: string): {
  events: AiStreamEvent[];
  rest: string;
} {
  const frames = chunk.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: AiStreamEvent[] = [];

  for (const frame of frames) {
    const line = frame.split("\n").find((entry) => entry.startsWith("data:"));
    if (!line) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      events.push(JSON.parse(payload) as AiStreamEvent);
    } catch {
      // Keep-alives and split frames should not fail a finished reply.
    }
  }

  return { events, rest };
}

export function isIgnorableStreamClose(cause: unknown, receivedText: boolean) {
  if (!(cause instanceof Error)) return false;
  if (cause.name === "AbortError") return true;
  if (!receivedText) return false;
  const message = cause.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("abort") ||
    message.includes("body stream") ||
    message.includes("connection")
  );
}
