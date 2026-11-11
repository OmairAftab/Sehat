import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAlert,
  poissonTail,
  simulateCases,
  subscribeAlerts,
  subscribeCases,
  ingestCase,
  parseLabReport,
  isMDR,
  weekly,
  type AlertRecord,
  type CaseRecord,
} from "./api";
test("Poisson tail and all three alert conditions", () => {
  assert.ok(Math.abs(poissonTail(5, 1) - 0.0036598468) < 1e-8);
  assert.equal(checkAlert(4, 1).alert, false);
  assert.equal(checkAlert(5, 1).alert, true);
  assert.equal(checkAlert(5, 2).alert, false);
  assert.equal(checkAlert(5, 0).alert, true);
});
test("Simulation emits a real alert and suppresses duplicates for 24 hours", async () => {
  let alerts: AlertRecord[] = [],
    cases: CaseRecord[] = [];
  const offA = subscribeAlerts((v) => (alerts = v)),
    offC = subscribeCases((v) => (cases = v));
  await simulateCases({
    villageId: "v6",
    syndromeGroup: "gi_waterborne",
    count: 5,
  });
  assert.equal(weekly(cases, "v6", "gi_waterborne"), 5);
  assert.equal(alerts.filter((a) => a.villageId === "v6").length, 1);
  assert.ok(alerts[0].pValue < 0.01);
  assert.equal(alerts[0].brief.split("\n").length, 5);
  await simulateCases({
    villageId: "v6",
    syndromeGroup: "gi_waterborne",
    count: 5,
  });
  assert.equal(alerts.filter((a) => a.villageId === "v6").length, 1);
  offA();
  offC();
});
test("Missing counts remain unknown and count as one in surveillance", async () => {
  await ingestCase({ text: "demo" });
  const c = await ingestCase({ text: "demo" });
  assert.equal(c.numPatients, null);
  assert.equal(c.severity, "unknown");
  assert.equal(c.needsReview, true);
  assert.equal(weekly([c]), 1);
});
test("Lab sample values and MDR respond to edited results", async () => {
  const first = await parseLabReport({ sampleId: "sample-1", villageId: "v1" });
  assert.equal(first.antibiotics.length, 16);
  assert.equal(isMDR(first.antibiotics), true);
  assert.equal(first.antibiotics.filter((d) => d.result === "S").length, 8);
  assert.equal(
    isMDR(first.antibiotics.map((d) => ({ ...d, result: "S" }))),
    false,
  );
  const second = await parseLabReport({
    sampleId: "sample-2",
    villageId: "v1",
  });
  assert.equal(second.antibiotics.length, 13);
  assert.equal(second.organism, "Salmonella enterica serovar Typhi");
  const upload = await parseLabReport({
    imageBase64: "demo",
    mimeType: "image/png",
    villageId: null,
  });
  assert.equal(upload.antibiotics.length, 0);
  assert.equal(upload.extractionConfidence, "low");
  assert.ok(upload.unreadableFields.length);
});
