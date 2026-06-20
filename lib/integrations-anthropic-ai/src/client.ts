import Anthropic from "@anthropic-ai/sdk";

function getClient(): Anthropic {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY 또는 ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }
  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
  return new Anthropic({
    apiKey,
    ...(useOpenRouter
      ? {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://aichat.app",
            "X-Title": "AI Chat",
          },
        }
      : {}),
  });
}

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) _client = getClient();
  return _client;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return (getAnthropicClient() as any)[prop];
  },
});
