"use client";

import type { AiChatMessage, AiClientContext, AiMode, AiStreamEvent } from "@/lib/ai/types";
import { useCallback, useEffect, useRef, useState } from "react";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStored(key: string): AiChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiChatMessage[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.content) : [];
  } catch {
    return [];
  }
}

export function useChatStream(mode: AiMode, context: AiClientContext) {
  const storageKey = `edge-log-ai-${mode}`;
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    setMessages(readStored(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(storageKey, JSON.stringify(messages.filter((item) => item.content)));
  }, [messages, storageKey]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
    sessionStorage.removeItem(storageKey);
  }, [stop, storageKey]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;

      const userMessage: AiChatMessage = {
        id: newId(),
        role: "user",
        content,
      };
      const assistantId = newId();
      const history = [...messages, userMessage];

      setError(null);
      setStreaming(true);
      setMessages([
        ...history,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            messages: history,
            context: contextRef.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || `Unable to reach the coach (${response.status}).`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame
              .split("\n")
              .find((entry) => entry.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            const event = JSON.parse(payload) as AiStreamEvent;
            if (event.type === "delta" && event.text) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId
                    ? { ...item, content: item.content + event.text }
                    : item
                )
              );
            }
            if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message =
          cause instanceof Error ? cause.message : "The stream dropped.";
        setError(message);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId && !item.content
              ? { ...item, content: `I could not finish that reply. ${message}` }
              : item
          )
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [messages, mode, streaming]
  );

  return { messages, streaming, error, send, stop, clear };
}
