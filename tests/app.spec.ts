import { test, expect } from "@playwright/test";
const base = process.env.SEHAT_QA_URL || "http://127.0.0.1:5173";
const village = {
  id: "osm-12345",
  name: "Thatta",
  nameUr: "ٹھٹھہ",
  lat: 24.746,
  lng: 67.925,
  baseline: {
    gi_waterborne: 0,
    fever_rash_joint: 0,
    jaundice: 0,
    respiratory: 0,
    other: 0,
    unclear: 0,
  },
  baselineConfigured: false,
};
const record = {
  id: "test-report",
  villageId: null,
  locationText: "Thatta",
  syndromeGroup: "gi_waterborne",
  numPatients: null,
  ageGroup: "children",
  symptoms: ["vomiting"],
  durationDays: 2,
  severity: "unknown",
  redFlags: [],
  confidence: "low",
  needsReview: true,
  transcriptEn: "Children reported with vomiting in Thatta.",
  createdAt: Date.now(),
  synthetic: false,
};
async function english(page: import("@playwright/test").Page, path = "/") {
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem("sehat-language", "en"));
  await page.goto(base + path);
}
test("clean bilingual routes fit 360 through 1920 pixels", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ["en", "ur"]) {
      await page.goto(base);
      await page.evaluate(
        (lang) => localStorage.setItem("sehat-language", lang),
        language,
      );
      for (const route of ["/", "/map", "/alerts", "/prescription", "/lab"]) {
        await page.goto(base + route);
        await expect(page.locator("h1")).toHaveCount(1);
        await page.waitForTimeout(250);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${width} ${language} ${route}`,
        ).toBeLessThanOrEqual(width);
      }
    }
  }
  expect(errors).toEqual([]);
});
test("missing key is honest and does not manufacture a success", async ({
  page,
}) => {
  await page.route("**/api/ingestCase", (r) =>
    r.fulfill({ status: 503, json: { error: "AI_NOT_CONFIGURED" } }),
  );
  await english(page);
  await expect(
    page.locator(".stats-grid,.intro-visual,.steps,.page-kicker"),
  ).toHaveCount(0);
  await page.getByRole("textbox").fill("Thatta mein bachon ko ulti hai");
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not connected");
  await expect(page.getByText("Report received", { exact: true })).toHaveCount(
    0,
  );
});
test("search selects a real location and keeps baseline uncalibrated", async ({
  page,
}) => {
  let registered = false;
  await page.route("**/api/snapshot", (r) =>
    r.fulfill({
      json: { villages: registered ? [village] : [], cases: [], alerts: [] },
    }),
  );
  await page.route("**/api/locations?*", (r) =>
    r.fulfill({
      json: [
        {
          placeId: "12345",
          name: "Thatta",
          displayName: "Thatta, Sindh, Pakistan",
          lat: 24.746,
          lng: 67.925,
        },
      ],
    }),
  );
  await page.route("**/api/registerLocation", (r) => {
    registered = true;
    return r.fulfill({ json: village });
  });
  await english(page, "/map");
  await page.getByRole("textbox").fill("Thatta, Sindh");
  await page
    .getByRole("button", { name: "Find location", exact: true })
    .click();
  await page.getByRole("button", { name: /Thatta, Sindh, Pakistan/ }).click();
  await expect(page.getByText(/Baseline not calibrated/)).toBeVisible();
  await expect(
    page.getByText("All villages normal", { exact: false }),
  ).toHaveCount(0);
});
test("voice recording sends captured audio and preserves uncertainty in the result", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  let captured = false;
  await page.route("**/api/ingestCase", (r) => {
    const body = r.request().postDataJSON();
    captured = Boolean(body.audioBase64 && body.mimeType?.startsWith("audio/"));
    return r.fulfill({ json: record });
  });
  await english(page);
  await page
    .getByRole("button", { name: "Tap to record", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(800);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByText("Report received", { exact: true }),
  ).toBeVisible();
  expect(captured).toBe(true);
  await expect(
    page.getByText("Count not mentioned", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Synthetic", { exact: true })).toHaveCount(0);
});
test("removed medical scanners redirect to reporting", async ({ page }) => {
  await english(page, "/prescription");
  await expect(page).toHaveURL(base + "/");
  await expect(
    page.getByRole("link", { name: "Prescription", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tap to record", exact: true }),
  ).toBeVisible();
  await page.goto(base + "/lab");
  await expect(page).toHaveURL(base + "/");
});
test("reduced motion, modal keyboard control and language persistence", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await page
    .getByRole("button", { name: "Switch language / زبان بدلیں" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("canvas.particles")).toHaveCount(0);
  await page.getByRole("button", { name: "Limitations", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".ripple")).toHaveCount(0);
});
