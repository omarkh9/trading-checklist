export type AiMode = "coach" | "support" | "audit";

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

export type AiChatResponse = {
  ok: boolean;
  text?: string;
  error?: string;
  fallback?: boolean;
};
