"use client";

import type { AiChatResponse, AiClientContext } from "@/lib/ai/types";
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

      const payload = (await response.json().catch(() => null)) as AiChatResponse | null;
      const reply = payload?.text?.trim() ?? "";
      if (!response.ok || !reply) {
        throw new Error(
          payload?.error || `Unable to run the audit (${response.status}).`
        );
      }
      setText(reply);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const message =
        cause instanceof Error ? cause.message : "The audit could not finish.";
      setError(message);
      setText(`I could not finish that audit. ${message}`);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  }, [streaming]);

  return { text, streaming, error, run, stop };
}
