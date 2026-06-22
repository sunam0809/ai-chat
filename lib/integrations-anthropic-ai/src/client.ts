export type StreamEvent =
  | { type: "content_block_delta"; delta: { type: "text_delta"; text: string } }
  | { type: "message_stop" };

const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  apiKey: string,
  retries = 3,
): Promise<Response> {
  const modelsToTry = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];

  for (const currentModel of modelsToTry) {
    let lastErr: string | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentModel,
          messages,
          stream: true,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (res.ok) return res;

      if (res.status === 429) {
        const body = await res.text();
        lastErr = body;
        const retryAfterHeader = res.headers.get("retry-after");
        const waitMs = retryAfterHeader
          ? parseFloat(retryAfterHeader) * 1000
          : Math.min(2000 * (attempt + 1), 10000);
        await sleep(waitMs);
        continue;
      }

      const body = await res.text();
      throw new Error(`Groq API 오류: ${res.status} ${body}`);
    }

    if (lastErr) continue;
  }

  throw new Error("Groq rate limit 초과 — 잠시 후 다시 시도해 주세요.");
}

export async function* streamChat(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  system?: string;
  max_tokens?: number;
}): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY가 설정되지 않았습니다.");

  const messages = [
    ...(params.system ? [{ role: "system", content: params.system }] : []),
    ...params.messages,
  ];

  const res = await fetchWithRetry(
    params.model,
    messages,
    params.max_tokens ?? 8192,
    apiKey,
  );

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const text = json.choices?.[0]?.delta?.content;
        if (text) {
          yield { type: "content_block_delta", delta: { type: "text_delta", text } };
        }
      } catch {}
    }
  }

  yield { type: "message_stop" };
}
