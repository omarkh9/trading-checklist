export type AiMode = "coach" | "support";

export type AiChatRole = "user" | "assistant";

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  content: string;
};

export type AiClientContext = {
  pathname?: string;
  pageTitle?: string;
  accountName?: string;
  accountId?: string;
};

export type AiChatRequest = {
  mode: AiMode;
  messages: AiChatMessage[];
  context?: AiClientContext;
};

export type AiStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
