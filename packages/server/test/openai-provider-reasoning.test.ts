import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "../src/services/llm/providers/openai.provider.js";
import type { ChatOptions } from "../src/services/llm/base-provider.js";

async function captureChatRequestBody(
  model: string,
  overrides: Partial<ChatOptions> = {},
  baseUrl = "https://example.com/v1",
) {
  const requests: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const provider = new OpenAIProvider(baseUrl, "test-key");
    const options: ChatOptions = {
      model,
      stream: false,
      maxTokens: 512,
      reasoningEffort: "high",
      ...overrides,
    };

    for await (const _ of provider.chat([{ role: "user", content: "Hello" }], options)) {
      // Consume the non-streaming generator.
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  return requests[0]!;
}

test("non-reasoning models do not receive reasoning payloads", async () => {
  const body = await captureChatRequestBody("mistral-small-latest");

  assert.equal("reasoning_effort" in body, false);
  assert.equal("enable_thinking" in body, false);
});

test("GLM models still use enable_thinking", async () => {
  const body = await captureChatRequestBody("glm-4.5");

  assert.equal(body.enable_thinking, true);
  assert.equal("reasoning_effort" in body, false);
});

test("OpenAI reasoning models still receive reasoning_effort", async () => {
  const body = await captureChatRequestBody("o3-mini");

  assert.equal(body.reasoning_effort, "high");
  assert.equal("enable_thinking" in body, false);
});

test("responses reasoning config is omitted for non-reasoning models", () => {
  const provider = new OpenAIProvider("https://example.com/v1", "test-key") as any;
  const body = provider.buildResponsesBody(
    [{ role: "user", content: "Hello" }],
    {
      model: "mistral-small-latest",
      stream: false,
      reasoningEffort: "high",
      enableThinking: true,
    } satisfies ChatOptions,
  ) as Record<string, unknown>;

  assert.equal("reasoning" in body, false);
  assert.equal("enable_thinking" in body, false);
});