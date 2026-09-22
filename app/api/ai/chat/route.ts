import { getAiConfig } from "@/lib/ai/env";
import {
  fallbackCoachReply,
  fallbackSupportReply,
  loadCoachInsights,
} from "@/lib/ai/coach-context";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { createSseResponse, streamFromText, streamOpenAiChat } from "@/lib/ai/stream";
import type { AiChatMessage, AiChatRequest, AiMode } from "@/lib/ai/types";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 16;
const MAX_CONTENT = 4000;

function cleanMessages(input: unknown): AiChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as { id?: unknown; role?: unknown; content?: unknown };
      const role: AiChatMessage["role"] =
        row.role === "assistant" ? "assistant" : "user";
      const content = String(row.content ?? "").slice(0, MAX_CONTENT);
      const id = String(row.id ?? `${role}-${content.slice(0, 12)}`);
      return { id, role, content } satisfies AiChatMessage;
    })
    .filter((item) => item.content.trim())
    .slice(-MAX_MESSAGES);
}

function isMode(value: unknown): value is AiMode {
  return value === "coach" || value === "support";
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: AiChatRequest;
  try {
    body = (await request.json()) as AiChatRequest;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const mode = isMode(body.mode) ? body.mode : "support";
  const messages = cleanMessages(body.messages);
  const lastUser = [...messages].reverse().find((item) => item.role === "user");
  if (!lastUser) {
    return Response.json({ ok: false, error: "empty" }, { status: 400 });
  }

  const insights =
    mode === "coach" ? await loadCoachInsights(body.context?.accountId) : null;
  const emailDomain = user.email?.split("@")[1] ?? null;
  const system = buildSystemPrompt(mode, {
    context: body.context,
    insights: insights ?? undefined,
    emailDomain,
  });

  const config = getAiConfig();
  if (!config.enabled) {
    const text =
      mode === "coach"
        ? fallbackCoachReply(insights, lastUser.content)
        : fallbackSupportReply(body.context?.pathname, lastUser.content);
    return createSseResponse(streamFromText(text));
  }

  try {
    const stream = await streamOpenAiChat({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages: [
        { role: "system", content: system },
        ...messages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
      ],
      signal: request.signal,
    });
    return createSseResponse(stream);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The model could not respond.";
    const fallback =
      mode === "coach"
        ? `${fallbackCoachReply(insights, lastUser.content)}\n\n_Live model error:_ ${message}`
        : `${fallbackSupportReply(body.context?.pathname, lastUser.content)}\n\n_Live model error:_ ${message}`;
    return createSseResponse(streamFromText(fallback, { delayMs: 12 }));
  }
}
