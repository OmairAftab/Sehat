export type SyndromeGroup =
  | "gi_waterborne"
  | "fever_rash_joint"
  | "jaundice"
  | "respiratory"
  | "other"
  | "unclear";
export type Confidence = "low" | "medium" | "high";
export interface Village {
  id: string;
  name: string;
  nameUr: string;
  lat: number;
  lng: number;
  baseline: Record<SyndromeGroup, number>;
  baselineConfigured?: boolean;
  boundary?: import("geojson").Polygon | import("geojson").MultiPolygon;
}
export interface CaseRecord {
  id: string;
  villageId: string | null;
  locationText?: string;
  syndromeGroup: SyndromeGroup;
  numPatients: number | null;
  ageGroup: string;
  symptoms: string[];
  durationDays: number | null;
  severity: "low" | "medium" | "urgent" | "unknown";
  redFlags: string[];
  confidence: Confidence;
  needsReview: boolean;
  transcriptEn: string;
  createdAt: number;
  synthetic: boolean;
}
export interface AlertRecord {
  id: string;
  villageId: string;
  syndromeGroup: SyndromeGroup;
  cases7d: number;
  baseline: number;
  pValue: number;
  brief: string;
  urduMessage: string;
  createdAt: number;
}
export interface LabAntibiotic {
  name: string;
  drugClass: string;
  aware: "Access" | "Watch" | "Reserve";
  result: "S" | "I" | "R" | "unknown";
}
export interface LabReport {
  id: string;
  villageId: string | null;
  specimen: string;
  organism: string;
  antibiotics: LabAntibiotic[];
  extractionConfidence: Confidence;
  unreadableFields: string[];
  synthetic: boolean;
}
export const groups: SyndromeGroup[] = [
  "gi_waterborne",
  "fever_rash_joint",
  "jaundice",
  "respiratory",
  "other",
  "unclear",
];
export const mock = import.meta.env
  ? import.meta.env.VITE_USE_MOCK === "true"
  : true;
const names = [
  ["Dhab Kalan", "ڈھب کلاں"],
  ["Chak Rehmat", "چک رحمت"],
  ["Basti Noor", "بستی نور"],
  ["Dhok Fateh", "ڈھوک فتح"],
  ["Kot Ameer", "کوٹ امیر"],
  ["Chak Sultan", "چک سلطان"],
];
const coords = [
  [32.9, 72.8],
  [33.0, 72.89],
  [32.82, 72.92],
  [32.94, 72.67],
  [32.79, 72.73],
  [33.06, 72.76],
];
const villages: Village[] = names.map(([name, nameUr], i) => ({
  id: `v${i + 1}`,
  name,
  nameUr,
  lat: coords[i][0],
  lng: coords[i][1],
  baseline: {
    gi_waterborne: 1,
    fever_rash_joint: 1,
    jaundice: 0.5,
    respiratory: 2,
    other: 1,
    unclear: 0,
  },
}));
let cases: CaseRecord[] = [];
let alerts: AlertRecord[] = [];
let rotation = 0;
const listeners = {
  villages: new Set<(v: Village[]) => void>(),
  cases: new Set<(v: CaseRecord[]) => void>(),
  alerts: new Set<(v: AlertRecord[]) => void>(),
};
function emit() {
  listeners.cases.forEach((f) => f([...cases]));
  listeners.alerts.forEach((f) => f([...alerts]));
}
async function realSubscribe<T>(
  collectionName: string,
  cb: (v: T[]) => void,
  onError?: (e: Error) => void,
) {
  const [{ initializeApp, getApps }, { getFirestore, collection, onSnapshot }] =
    await Promise.all([import("firebase/app"), import("firebase/firestore")]);
  const env = import.meta.env;
  const app =
    getApps()[0] ||
    initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
  return onSnapshot(
    collection(getFirestore(app), collectionName),
    (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)),
    (e) => onError?.(e),
  );
}
function subscribe<T>(
  name: keyof typeof listeners,
  cb: (v: T[]) => void,
  onError?: (e: Error) => void,
) {
  if (!mock && !import.meta.env.VITE_FUNCTIONS_URL) {
    let previous = "";
    let stopped = false,
      inFlight = false;
    const controller = new AbortController();
    const update = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const response = await fetch("/api/snapshot", {
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Connection failed");
        const snapshot = await response.json();
        const serialized = JSON.stringify(snapshot[name]);
        if (!stopped && previous !== serialized) {
          previous = serialized;
          cb(snapshot[name]);
        }
      } catch (e) {
        previous = "";
        if (!stopped) onError?.(e as Error);
      } finally {
        inFlight = false;
      }
    };
    void update();
    const timer = setInterval(update, 5000);
    addEventListener("sehat-data-change", update);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      removeEventListener("sehat-data-change", update);
    };
  }
  if (!mock) {
    let disposed = false;
    let off: (() => void) | undefined;
    realSubscribe(name, cb, onError)
      .then((fn) => {
        if (disposed) fn();
        else off = fn;
      })
      .catch((e) => onError?.(e));
    return () => {
      disposed = true;
      off?.();
    };
  }
  const set = listeners[name] as Set<(v: T[]) => void>;
  set.add(cb);
  cb(
    (name === "villages" ? villages : name === "cases" ? cases : alerts) as T[],
  );
  return () => {
    set.delete(cb);
  };
}
export const subscribeVillages = (
  cb: (v: Village[]) => void,
  e?: (e: Error) => void,
) => subscribe("villages", cb, e);
export const subscribeCases = (
  cb: (v: CaseRecord[]) => void,
  e?: (e: Error) => void,
) => subscribe("cases", cb, e);
export const subscribeAlerts = (
  cb: (v: AlertRecord[]) => void,
  e?: (e: Error) => void,
) => subscribe("alerts", cb, e);
export function poissonTail(k: number, lambda: number) {
  let p = 0,
    term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    p += term;
    term *= lambda / (i + 1);
  }
  return Math.max(0, Math.min(1, 1 - p));
}
export function checkAlert(cases7d: number, baseline: number) {
  const pValue = poissonTail(cases7d, Math.max(baseline, 0.5));
  return {
    pValue,
    alert: cases7d >= 5 && cases7d >= 3 * baseline && pValue < 0.01,
  };
}
export function weekly(
  source: CaseRecord[],
  villageId?: string,
  group?: SyndromeGroup,
) {
  return source
    .filter(
      (c) =>
        c.createdAt >= Date.now() - 7 * 86400000 &&
        (!villageId || c.villageId === villageId) &&
        (!group || c.syndromeGroup === group),
    )
    .reduce((n, c) => n + (c.numPatients ?? 1), 0);
}
function evaluate() {
  for (const v of villages)
    for (const g of groups) {
      const n = weekly(cases, v.id, g),
        baseline = v.baseline[g],
        test = checkAlert(n, baseline);
      if (
        test.alert &&
        !alerts.some(
          (a) =>
            a.villageId === v.id &&
            a.syndromeGroup === g &&
            a.createdAt > Date.now() - 86400000,
        )
      ) {
        alerts.unshift({
          id: crypto.randomUUID(),
          villageId: v.id,
          syndromeGroup: g,
          cases7d: n,
          baseline,
          pValue: test.pValue,
          createdAt: Date.now(),
          brief: `${n} people reported with ${g.replaceAll("_", " ")} symptoms in ${v.name} over 7 days.\nCheck the reports, water sources and affected households first.\nRecheck within 6 hours.\nInform the district health officer and local health worker.\nVerify on the ground.`,
          urduMessage:
            "گاؤں میں معمول سے زیادہ علامات کی اطلاع ملی ہے۔ صحت کارکن کو اطلاع دیں۔ متاثرہ گھرانوں کی خبر لیں۔ موقع پر تصدیق ضروری ہے۔",
        });
      }
    }
  emit();
}
const delay = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
async function request<T>(path: string, body: unknown): Promise<T> {
  const base = import.meta.env.VITE_FUNCTIONS_URL || "/api";
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    path === "parsePrescription" ? 125000 : 65000,
  );
  try {
    const r = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await r.json();
    if (!r.ok) throw Error(result.error || `Request failed (${r.status})`);
    dispatchEvent(new Event("sehat-data-change"));
    return result;
  } finally {
    clearTimeout(timer);
  }
}
export async function ingestCase(
  input: { audioBase64: string; mimeType: string } | { text: string },
): Promise<CaseRecord> {
  if (!mock) return request("ingestCase", input);
  await delay();
  const index = rotation++ % 4;
  const samples = [
    {
      villageId: "v1",
      numPatients: 3,
      ageGroup: "children",
      symptoms: ["fever", "vomiting"],
      durationDays: 2,
      syndromeGroup: "gi_waterborne",
      severity: "medium",
      confidence: "high",
      needsReview: false,
    },
    {
      villageId: "v1",
      numPatients: null,
      ageGroup: "children",
      symptoms: ["vomiting"],
      durationDays: 2,
      syndromeGroup: "gi_waterborne",
      severity: "unknown",
      confidence: "low",
      needsReview: true,
    },
    {
      villageId: "v2",
      numPatients: 2,
      ageGroup: "adults",
      symptoms: ["yellow eyes", "weakness"],
      durationDays: 5,
      syndromeGroup: "jaundice",
      severity: "medium",
      confidence: "medium",
      needsReview: false,
    },
    {
      villageId: "v3",
      numPatients: 4,
      ageGroup: "children",
      symptoms: ["cough", "fever"],
      durationDays: 3,
      syndromeGroup: "respiratory",
      severity: "medium",
      confidence: "high",
      needsReview: false,
    },
  ] as const;
  const s = samples[index];
  const c: CaseRecord = {
    ...s,
    symptoms: [...s.symptoms],
    id: crypto.randomUUID(),
    redFlags: [],
    transcriptEn: `Synthetic sample: ${s.numPatients ?? "Unstated number of"} ${s.ageGroup}, ${s.symptoms.join(" and ")}, ${s.durationDays} days.`,
    createdAt: Date.now(),
    synthetic: true,
  };
  cases.unshift(c);
  evaluate();
  return c;
}
export async function simulateCases(input: {
  villageId: string;
  syndromeGroup: SyndromeGroup;
  count: number;
}) {
  if (!mock) return request<void>("simulateCases", input);
  await delay(900);
  const symptoms: Record<SyndromeGroup, string[]> = {
    gi_waterborne: ["vomiting", "diarrhoea"],
    fever_rash_joint: ["fever", "rash"],
    jaundice: ["yellow eyes", "weakness"],
    respiratory: ["cough", "fever"],
    other: ["weakness"],
    unclear: [],
  };
  for (let i = 0; i < Math.min(10, Math.max(1, input.count)); i++)
    cases.unshift({
      id: crypto.randomUUID(),
      villageId: input.villageId,
      syndromeGroup: input.syndromeGroup,
      numPatients: 1,
      ageGroup: "unknown",
      symptoms: symptoms[input.syndromeGroup],
      durationDays: 2,
      severity: "unknown",
      redFlags: [],
      confidence: "medium",
      needsReview: true,
      transcriptEn: "Synthetic demo report.",
      createdAt: Date.now() - i * 6 * 3600000,
      synthetic: true,
    });
  evaluate();
}
// All lab values below are DEMO PLACEHOLDERS, not a clinical reference.
const rows1 = [
  ["Ampicillin", "penicillins", "Access", "R"],
  ["Amoxicillin-Clavulanate", "penicillins", "Access", "I"],
  ["Cefazolin", "cephalosporins", "Access", "R"],
  ["Ceftriaxone", "cephalosporins", "Watch", "R"],
  ["Cefepime", "cephalosporins", "Watch", "I"],
  ["Ciprofloxacin", "fluoroquinolones", "Watch", "R"],
  ["Levofloxacin", "fluoroquinolones", "Watch", "R"],
  ["Gentamicin", "aminoglycosides", "Access", "S"],
  ["Amikacin", "aminoglycosides", "Access", "S"],
  ["Trimethoprim-Sulfamethoxazole", "folate-pathway-inhibitors", "Access", "R"],
  ["Nitrofurantoin", "nitrofurans", "Access", "S"],
  ["Fosfomycin", "phosphonics", "Access", "S"],
  ["Piperacillin-Tazobactam", "penicillin-inhibitor-combos", "Watch", "S"],
  ["Meropenem", "carbapenems", "Watch", "S"],
  ["Imipenem", "carbapenems", "Watch", "S"],
  ["Ertapenem", "carbapenems", "Watch", "S"],
];
const rows2 = [
  ["Ampicillin", "penicillins", "Access", "R"],
  ["Chloramphenicol", "phenicols", "Access", "R"],
  ["Trimethoprim-Sulfamethoxazole", "folate-pathway-inhibitors", "Access", "R"],
  ["Amoxicillin-Clavulanate", "penicillins", "Access", "R"],
  ["Ceftriaxone", "cephalosporins", "Watch", "R"],
  ["Cefixime", "cephalosporins", "Watch", "R"],
  ["Ciprofloxacin", "fluoroquinolones", "Watch", "R"],
  ["Levofloxacin", "fluoroquinolones", "Watch", "R"],
  ["Piperacillin-Tazobactam", "penicillin-inhibitor-combos", "Watch", "I"],
  ["Azithromycin", "macrolides", "Watch", "S"],
  ["Meropenem", "carbapenems", "Watch", "S"],
  ["Imipenem", "carbapenems", "Watch", "S"],
  ["Ertapenem", "carbapenems", "Watch", "S"],
];
export async function parseLabReport(
  input: ({ imageBase64: string; mimeType: string } | { sampleId: string }) & {
    villageId: string | null;
  },
): Promise<LabReport> {
  if (!mock) return request("parseLabReport", input);
  await delay();
  const second = "sampleId" in input && input.sampleId === "sample-2";
  const uploaded = "imageBase64" in input;
  return {
    id: crypto.randomUUID(),
    villageId: input.villageId,
    specimen: uploaded ? "unknown" : second ? "Blood" : "Urine (midstream)",
    organism: uploaded
      ? "unknown"
      : second
        ? "Salmonella enterica serovar Typhi"
        : "Escherichia coli",
    antibiotics: uploaded
      ? []
      : (second ? rows2 : rows1).map(
          ([name, drugClass, aware, result]) =>
            ({ name, drugClass, aware, result }) as LabAntibiotic,
        ),
    extractionConfidence: uploaded ? "low" : "high",
    unreadableFields: uploaded
      ? ["Mock mode does not read uploaded images. Load a sample report."]
      : [],
    synthetic: true,
  };
}
export function isMDR(drugs: LabAntibiotic[]) {
  return (
    new Set(drugs.filter((d) => d.result === "R").map((d) => d.drugClass))
      .size >= 3
  );
}

export interface LocationSearchResult {
  boundary?: import("geojson").Polygon | import("geojson").MultiPolygon;
  placeId: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}
export async function searchLocations(
  query: string,
): Promise<LocationSearchResult[]> {
  const response = await fetch("/api/locations?q=" + encodeURIComponent(query));
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "SEARCH_FAILED");
  return data;
}
export const registerLocation = (placeId: string) =>
  request<Village>("registerLocation", { placeId });

export const assignCaseLocation = (caseId: string, villageId: string) =>
  request<CaseRecord>("assignCaseLocation", { caseId, villageId });

export const parsePrescription = (input: {
  imageBase64: string;
  mimeType: string;
  villageId: string | null;
}) =>
  request<import("./prescriptionTypes").PrescriptionReport>(
    "parsePrescription",
    input,
  );
