export class GeminiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export const defaultModels = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
];
export function configuredModels(env: Record<string, string>) {
  return [
    ...new Set(
      [
        ...(env.GEMINI_MODELS || env.GEMINI_MODEL || "")
          .split(",")
          .map((m) => m.trim().replace(/^models\//, "")),
        ...defaultModels,
      ].filter((m) => /^gemini-[a-zA-Z0-9.-]+$/.test(m)),
    ),
  ].slice(0, 8);
}
export function createGeminiClient(env: Record<string, string>) {
  const models = configuredModels(env),
    cooldown = new Map<string, number>();
  let lastWorking = "";
  return async (
    system: string,
    parts: unknown[],
    schema: unknown,
  ): Promise<Record<string, unknown>> => {
    if (!env.GEMINI_API_KEY) throw new GeminiError(503, "AI_NOT_CONFIGURED");
    const deadline = Date.now() + 55000;
    const available = models.filter(
      (m) => (cooldown.get(m) || 0) <= Date.now(),
    );
    if (!available.length) throw new GeminiError(429, "AI_RATE_LIMIT");
    const order =
      lastWorking && available.includes(lastWorking)
        ? [lastWorking, ...available.filter((m) => m !== lastWorking)]
        : available;
    let last = new GeminiError(502, "AI_REQUEST_FAILED");
    for (const model of order) {
      const remaining = deadline - Date.now();
      if (remaining < 1000) break;
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY,
            },
            signal: AbortSignal.timeout(Math.min(30000, remaining)),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: schema,
                ...(/^gemini-3\.(8|6|5)-flash$/.test(model)
                  ? { thinkingConfig: { thinkingLevel: "low" } }
                  : {}),
              },
            }),
          },
        );
        if (response.status === 401 || response.status === 403)
          throw new GeminiError(response.status, "AI_AUTH_FAILED");
        if (!response.ok) {
          if (response.status === 429) {
            last = new GeminiError(429, "AI_RATE_LIMIT");
            cooldown.set(model, Date.now() + 60000);
          } else if (response.status === 404 || response.status === 400) {
            last = new GeminiError(502, "AI_MODEL_UNAVAILABLE");
            cooldown.set(model, Date.now() + 600000);
          } else if (response.status >= 500) {
            last = new GeminiError(502, "AI_REQUEST_FAILED");
            cooldown.set(model, Date.now() + 10000);
          } else throw new GeminiError(502, "AI_REQUEST_FAILED");
          continue;
        }
        const body = (await response.json()) as {
          promptFeedback?: { blockReason?: string };
          candidates?: {
            finishReason?: string;
            content?: { parts?: { text?: string; thought?: boolean }[] };
          }[];
        };
        if (
          body.promptFeedback?.blockReason ||
          body.candidates?.some((c) => c.finishReason === "SAFETY")
        )
          throw new GeminiError(422, "AI_INPUT_REJECTED");
        let parsed: unknown;
        try {
          parsed = JSON.parse(
            body.candidates?.[0]?.content?.parts
              ?.filter((p) => !p.thought)
              .map((p) => p.text || "")
              .join("") || "",
          );
        } catch {
          last = new GeminiError(502, "AI_RESPONSE_INVALID");
          continue;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          last = new GeminiError(502, "AI_RESPONSE_INVALID");
          continue;
        }
        lastWorking = model;
        return parsed as Record<string, unknown>;
      } catch (error) {
        if (error instanceof GeminiError) throw error;
        last = new GeminiError(502, "AI_REQUEST_FAILED");
        cooldown.set(model, Date.now() + 10000);
      }
    }
    throw last;
  };
}
