import type { AiStreamEvent } from "@/lib/ai/types";

export function encodeSse(event: AiStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function streamFromText(
  text: string,
  options?: { delayMs?: number }
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const delayMs = options?.delayMs ?? 16;
  const chunks = text.split(/(\s+)/).filter(Boolean);

  return new ReadableStream({
    async start(controller) {
      try {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(encodeSse({ type: "delta", text: chunk })));
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
        controller.enqueue(encoder.encode(encodeSse({ type: "done" })));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "error",
              message: error instanceof Error ? error.message : "Stream failed.",
            })
          )
        );
        controller.close();
      }
    },
  });
}

export async function streamOpenAiChat(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      temperature: 0.6,
      messages: options.messages,
    }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail.slice(0, 240) || `The model request failed (${response.status}).`
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode(encodeSse({ type: "done" })));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const text = json.choices?.[0]?.delta?.content;
          if (text) {
            controller.enqueue(
              encoder.encode(encodeSse({ type: "delta", text }))
            );
          }
        } catch {
          // Ignore keep-alives and partial JSON frames.
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}
