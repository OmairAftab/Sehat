import { test } from "node:test";
import assert from "node:assert/strict";
import { createGeminiClient, GeminiError, defaultModels } from "./gemini";
const success = () =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
    }),
  );
test("unavailable and rate-limited models fall back; next reading reuses the working model", async (t) => {
  const attempted: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      const model = String(input).split("/models/")[1].split(":")[0];
      attempted.push(model);
      if (model === defaultModels[0])
        return new Response("{}", { status: 404 });
      if (model === defaultModels[1])
        return new Response("{}", { status: 429 });
      return success();
    },
  );
  const generate = createGeminiClient({ GEMINI_API_KEY: "test-only" });
  assert.deepEqual(await generate("read", [], {}), { ok: true });
  assert.deepEqual(attempted, defaultModels.slice(0, 3));
  attempted.length = 0;
  await generate("read again", [], {});
  assert.deepEqual(attempted, [defaultModels[2]]);
});
test("invalid authentication stops rather than looping through models", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("{}", { status: 401 });
  });
  await assert.rejects(
    createGeminiClient({ GEMINI_API_KEY: "test-only" })("read", [], {}),
    (error: unknown) =>
      error instanceof GeminiError && error.code === "AI_AUTH_FAILED",
  );
  assert.equal(calls, 1);
});
test("network failure and malformed output fall back to a valid structured response", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1) throw new TypeError("Network unavailable");
    if (calls === 2)
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "bad json" }] } }],
        }),
      );
    return success();
  });
  assert.deepEqual(
    await createGeminiClient({ GEMINI_API_KEY: "test-only" })("read", [], {}),
    { ok: true },
  );
  assert.equal(calls, 3);
});
test("a blocked input is not retried against other models", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(
      JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }),
    );
  });
  await assert.rejects(
    createGeminiClient({ GEMINI_API_KEY: "test-only" })("read", [], {}),
    (error: unknown) =>
      error instanceof GeminiError && error.code === "AI_INPUT_REJECTED",
  );
  assert.equal(calls, 1);
});
