"use client";

import { isIgnorableStreamClose, parseSseFrames } from "@/lib/ai/sse";
import type { AiClientContext, AiStreamEvent } from "@/lib/ai/types";
import { useCallback, useRef, useState } from "react";

const AUDIT_PROMPT =
  "Run an automated behavioral audit of my journal. Call out win-rate patterns, session performance leaks, and risk-discipline issues. Give a verdict and the next five trades I should change.";

export function useBehavioralAudit(context: AiClientContext) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const run = useCallback(async () => {
    if (streaming) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setText("");
    setStreaming(true);
    let assembled = "";

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "audit",
          messages: [{ id: "audit-user", role: "user", content: AUDIT_PROMPT }],
          context: contextRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || `Unable to run the audit (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const applyEvents = (events: AiStreamEvent[]) => {
        for (const event of events) {
          if (event.type === "delta" && event.text) {
            assembled += event.text;
            setText(assembled);
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
          if (event.type === "done") {
            finished = true;
          }
        }
      };

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) {
          const leftover = buffer + decoder.decode();
          if (leftover.trim()) {
            applyEvents(parseSseFrames(`${leftover}\n\n`).events);
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseFrames(buffer);
        buffer = parsed.rest;
        applyEvents(parsed.events);
      }

      if (finished) {
        try {
          await reader.cancel();
        } catch {
          // The proxy may already have closed the body.
        }
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (isIgnorableStreamClose(cause, Boolean(assembled))) return;
      const message =
        cause instanceof Error ? cause.message : "The audit stream dropped.";
      setError(message);
      if (!assembled) {
        setText(`I could not finish that audit. ${message}`);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  }, [streaming]);

  return { text, streaming, error, run, stop };
}
