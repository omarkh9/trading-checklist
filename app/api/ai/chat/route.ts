import { getAiConfig } from "@/lib/ai/env";
import {
  fallbackAuditReply,
  fallbackCoachReply,
  fallbackSupportReply,
  loadAuditInsights,
  loadCoachInsights,
} from "@/lib/ai/coach-context";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { completeOpenAiChat } from "@/lib/ai/stream";
import type { AiChatMessage, AiChatRequest, AiMode } from "@/lib/ai/types";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_MESSAGES = 12;
const MAX_CONTENT = 2000;
const COACH_DEADLINE_MS = 8_000;

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
  return value === "coach" || value === "support" || value === "audit";
}

function fallbackForMode(
  mode: AiMode,
  insights: string | null,
  lastUser: string,
  pathname?: string
) {
  if (mode === "coach") return fallbackCoachReply(insights, lastUser);
  if (mode === "audit") return fallbackAuditReply(insights, lastUser);
  return fallbackSupportReply(pathname, lastUser);
}

function deadlineSignal(request: Request, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (request.signal.aborted) controller.abort();
  else {
    request.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }
  return {
    signal: controller.signal,
    stop() {
      clearTimeout(timer);
    },
  };
}

function jsonReply(text: string, extra?: { fallback?: boolean }) {
  return Response.json({ ok: true, text, ...extra });
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

  const deadline = deadlineSignal(request, COACH_DEADLINE_MS);

  try {
    const insights =
      mode === "coach"
        ? await loadCoachInsights(body.context?.accountId, user.id)
        : mode === "audit"
          ? await loadAuditInsights(body.context?.accountId, user.id)
          : null;

    if (deadline.signal.aborted) {
      return jsonReply(
        fallbackForMode(mode, insights, lastUser.content, body.context?.pathname),
        { fallback: true }
      );
    }

    const system = buildSystemPrompt(mode, {
      context: body.context,
      insights: insights ?? undefined,
      emailDomain: user.email?.split("@")[1] ?? null,
    });
    const config = getAiConfig();

    if (!config.enabled) {
      return jsonReply(
        fallbackForMode(mode, insights, lastUser.content, body.context?.pathname)
      );
    }

    const text = await completeOpenAiChat({
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
      signal: deadline.signal,
    });
    return jsonReply(text);
  } catch (error) {
    const fallback = fallbackForMode(
      mode,
      null,
      lastUser.content,
      body.context?.pathname
    );
    if (deadline.signal.aborted) {
      return jsonReply(
        `${fallback}\n\n_The live model timed out, so this is the local read._`,
        { fallback: true }
      );
    }
    const message =
      error instanceof Error ? error.message : "The model could not respond.";
    return jsonReply(`${fallback}\n\n_Live model error:_ ${message}`, {
      fallback: true,
    });
  } finally {
    deadline.stop();
  }
}
