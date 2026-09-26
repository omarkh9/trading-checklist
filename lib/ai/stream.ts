export async function completeOpenAiChat(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      stream: false,
      temperature: 0.6,
      max_tokens: 500,
      messages: options.messages,
    }),
    signal: options.signal,
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message?.slice(0, 240) ||
        `The model request failed (${response.status}).`
    );
  }

  const text = payload?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("The model returned an empty reply.");
  }
  return text;
}
