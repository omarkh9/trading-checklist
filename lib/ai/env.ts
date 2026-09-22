export function getAiConfig() {
  const apiKey = (
    process.env.OPENAI_API_KEY ||
    process.env.AI_API_KEY ||
    ""
  ).trim();
  const baseUrl = (
    process.env.OPENAI_BASE_URL ||
    process.env.AI_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = (
    process.env.OPENAI_MODEL ||
    process.env.AI_MODEL ||
    "gpt-4o-mini"
  ).trim();

  return {
    apiKey,
    baseUrl,
    model,
    enabled: Boolean(apiKey),
  };
}
