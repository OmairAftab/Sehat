import { test } from "node:test";
import assert from "node:assert/strict";
import { compareReadings, normalizeReading } from "./prescription";
import { prescriptionFields } from "../src/lib/prescriptionTypes";
const absent = () => ({ value: null, sourceText: null, status: "not_present" });
const readable = (value: string, sourceText = value) => ({
  value,
  sourceText,
  status: "readable",
});
function reading() {
  return {
    documentType: "prescription",
    imageQuality: "clear",
    issues: [],
    medicines: [
      {
        lineNumber: 1,
        fields: {
          ...Object.fromEntries(prescriptionFields.map((k) => [k, absent()])),
          name: readable("ExampleTablet"),
          strength: readable("5 mg"),
          frequency: readable("BD"),
          duration: readable("3 days"),
        },
      },
    ],
  };
}
test("agreed literal abbreviations stay unchanged, absent fields stay null", () => {
  const a = reading(),
    result = compareReadings(a, structuredClone(a));
  assert.equal(result.medicines[0].fields.frequency.value, "BD");
  assert.equal(result.medicines[0].fields.dose.value, null);
  assert.equal(result.medicines[0].fields.dose.status, "not_present");
  assert.equal(result.medicines[0].fields.strength.value, "5 mg");
});
test("different digits are withheld instead of choosing a dose", () => {
  const a = reading(),
    b = reading();
  b.medicines[0].fields.strength = readable("50 mg");
  const result = compareReadings(a, b);
  assert.equal(result.medicines[0].fields.strength.value, null);
  assert.equal(result.medicines[0].fields.strength.status, "unclear");
  assert.ok(result.issues.includes("model_disagreement"));
});
test("unsupported decimal substring and invented units cannot pass evidence check", () => {
  const a = reading();
  a.medicines[0].fields.strength = readable("5 mg", "0.5 mg");
  a.medicines[0].fields.duration = readable("3 days", "3");
  const result = normalizeReading(a);
  assert.equal(result.medicines[0].fields.strength.status, "unclear");
  assert.equal(result.medicines[0].fields.duration.status, "unclear");
});
test("ambiguous medicine name withholds instructions for that line", () => {
  const a = reading(),
    b = reading();
  b.medicines[0].fields.name = readable("OtherTablet");
  const result = compareReadings(a, b);
  assert.ok(
    prescriptionFields.every(
      (k) => result.medicines[0].fields[k].value === null,
    ),
  );
});
test("different line counts cannot silently pair instructions with a wrong medicine", () => {
  const a = reading(),
    b = reading();
  b.medicines.push(structuredClone(b.medicines[0]));
  const result = compareReadings(a, b);
  assert.equal(result.medicines.length, 2);
  assert.ok(
    result.medicines.every((m) =>
      prescriptionFields.every((k) => m.fields[k].status === "unclear"),
    ),
  );
});
test("non-prescriptions and unreadable images return no medicine instructions", () => {
  const a = { ...reading(), documentType: "other_medical_document" };
  assert.equal(compareReadings(a, a).medicines.length, 0);
  const b = { ...reading(), imageQuality: "unreadable" };
  assert.equal(compareReadings(b, b).medicines.length, 0);
  assert.equal(compareReadings(reading(), a).documentType, "unreadable");
});
test("different quote lengths retain the same literal name when both quotes support it", () => {
  const a = reading(),
    b = reading();
  a.medicines[0].fields.name = readable(
    "ExampleTablet",
    "Medicine: ExampleTablet",
  );
  b.medicines[0].fields.name = readable("ExampleTablet", "ExampleTablet");
  const result = compareReadings(a, b);
  assert.equal(result.medicines[0].fields.name.value, "ExampleTablet");
  assert.equal(result.medicines[0].fields.name.status, "readable");
});
