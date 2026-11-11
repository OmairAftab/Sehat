import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { liveApi } from "./api";
async function start(env: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), "sehat-api-"));
  let handle:
    | ((req: IncomingMessage, res: ServerResponse, next: () => void) => void)
    | undefined;
  const plugin = liveApi(env, root);
  const hook = plugin.configureServer;
  if (typeof hook !== "function") throw Error("Missing hook");
  await hook.call(
    {} as never,
    {
      middlewares: {
        use(fn: typeof handle) {
          handle = fn;
        },
      },
    } as never,
  );
  const server = createServer((req, res) =>
    handle!(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No address");
  return {
    root,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
const originalFetch = globalThis.fetch;
test("unconfigured live service has zero fabricated data and refuses AI ingestion", async () => {
  const app = await start({});
  try {
    const snapshot = await (
      await originalFetch(app.url + "/api/snapshot")
    ).json();
    assert.deepEqual(snapshot, { villages: [], cases: [], alerts: [] });
    const response = await originalFetch(app.url + "/api/ingestCase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "A report" }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "AI_NOT_CONFIGURED");
    assert.equal(
      (await (await originalFetch(app.url + "/api/status")).json())
        .aiConfigured,
      false,
    );
  } finally {
    await app.close();
  }
});
test("actual submitted text reaches server-side Gemini; unknown counts stay null and records persist", async (t) => {
  const app = await start({ GEMINI_API_KEY: "server-secret-test-key" });
  const response = {
    location_text: "Thatta",
    numPatients: null,
    ageGroup: "children",
    symptoms: ["vomiting"],
    durationDays: 2,
    syndromeGroup: "gi_waterborne",
    severity: "urgent",
    redFlags: [],
    confidence: "high",
    transcriptEn: "Children with vomiting for two days in Thatta.",
  };
  let sent = "";
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://generativelanguage.googleapis.com/")) {
        sent = String(init?.body);
        assert.equal(
          (init?.headers as Record<string, string>)["x-goog-api-key"],
          "server-secret-test-key",
        );
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(response) }] } },
            ],
          }),
          { status: 200 },
        );
      }
      return originalFetch(input, init);
    },
  );
  try {
    const r = await originalFetch(app.url + "/api/ingestCase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Thatta mein bachon ko 2 din se ulti hai" }),
    });
    assert.equal(r.status, 200);
    const record = await r.json();
    assert.ok(sent.includes("Thatta mein bachon ko 2 din se ulti hai"));
    assert.equal(record.numPatients, null);
    assert.equal(record.severity, "unknown");
    assert.equal(record.confidence, "low");
    assert.equal(record.synthetic, false);
    assert.equal(record.villageId, null);
    const persisted = JSON.parse(
      await readFile(path.join(app.root, ".sehat-data/records.json"), "utf8"),
    );
    assert.equal(persisted.cases.length, 1);
    assert.equal(persisted.alerts.length, 0);
    assert.ok(!JSON.stringify(persisted).includes("server-secret-test-key"));
  } finally {
    await app.close();
  }
});
test("genuine place search registers selected results without inventing baseline or reports", async (t) => {
  const app = await start({});
  let searches = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input).startsWith("https://nominatim.openstreetmap.org/")) {
        searches++;
        assert.ok(String(input).includes("countrycodes=pk"));
        assert.ok(String(input).includes("polygon_geojson=1"));
        return new Response(
          JSON.stringify([
            {
              place_id: 12345,
              name: "Thatta",
              display_name: "Thatta, Sindh, Pakistan",
              lat: "24.746",
              lon: "67.925",
            },
          ]),
        );
      }
      return originalFetch(input, init);
    },
  );
  try {
    const found = await (
      await originalFetch(app.url + "/api/locations?q=Thatta")
    ).json();
    assert.equal(found[0].name, "Thatta");
    await originalFetch(app.url + "/api/locations?q=Thatta");
    assert.equal(searches, 1);
    const added = await (
      await originalFetch(app.url + "/api/registerLocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: "12345" }),
      })
    ).json();
    assert.equal(added.baselineConfigured, false);
    const snapshot = await (
      await originalFetch(app.url + "/api/snapshot")
    ).json();
    assert.equal(snapshot.villages.length, 1);
    assert.equal(snapshot.cases.length, 0);
    assert.equal(snapshot.alerts.length, 0);
  } finally {
    await app.close();
  }
});
test("prescription endpoint compares both provider readings and persists uncertainty", async (t) => {
  const app = await start({ GEMINI_API_KEY: "server-secret-test-key" });
  let calls = 0;
  const absent = { value: null, sourceText: null, status: "not_present" };
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (
        String(input).startsWith("https://generativelanguage.googleapis.com/")
      ) {
        calls++;
        const payload = JSON.parse(String(init?.body));
        assert.ok(
          payload.systemInstruction.parts[0].text.includes("not a prescriber"),
        );
        const strength = calls === 1 ? "5 mg" : "50 mg";
        const reading = {
          documentType: "prescription",
          imageQuality: "clear",
          medicines: [
            {
              lineNumber: 1,
              fields: {
                name: {
                  value: "ExampleTablet",
                  sourceText: "ExampleTablet",
                  status: "readable",
                },
                strength: {
                  value: strength,
                  sourceText: strength,
                  status: "readable",
                },
                dose: absent,
                route: absent,
                frequency: absent,
                duration: absent,
                instructions: absent,
              },
            },
          ],
          issues: [],
        };
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(reading) }] } },
            ],
          }),
        );
      }
      return originalFetch(input, init);
    },
  );
  try {
    const response = await originalFetch(app.url + "/api/parsePrescription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: "AA==",
        mimeType: "image/png",
        villageId: null,
      }),
    });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(calls, 2);
    assert.equal(report.medicines[0].fields.strength.value, null);
    assert.equal(report.medicines[0].fields.name.value, "ExampleTablet");
    assert.equal(report.requiresProfessionalReview, true);
    const stored = JSON.parse(
      await readFile(path.join(app.root, ".sehat-data/records.json"), "utf8"),
    );
    assert.equal(stored.prescriptions.length, 1);
    assert.equal(stored.labs.length, 0);
    assert.ok(!JSON.stringify(stored).includes("server-secret-test-key"));
  } finally {
    await app.close();
  }
});
