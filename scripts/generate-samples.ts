import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { parseLabReport } from "../src/lib/api";
await mkdir("public/samples", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 800, height: 1100 },
  deviceScaleFactor: 1,
});
for (const sampleId of ["sample-1", "sample-2"]) {
  const r = await parseLabReport({ sampleId, villageId: "v1" });
  await page.setContent(
    `<html><body style="margin:0;padding:48px;font-family:Arial;color:#173843;background:#f5f7f5"><div style="border:2px solid #369c8e;padding:32px"><p style="letter-spacing:3px;color:#208374">SEHAT SIPAHI · SYNTHETIC SAMPLE</p><h1>Culture & sensitivity</h1><p>DEMO PLACEHOLDERS — NOT A REAL PATIENT REPORT</p><hr><p>Specimen: ${r.specimen}</p><p>Organism: <i>${r.organism}</i></p><table style="width:100%;border-collapse:collapse;margin-top:32px"><tr><th style="text-align:left">Antibiotic</th><th>Result</th></tr>${r.antibiotics.map((d) => `<tr><td style="padding:12px 0;border-bottom:1px solid #ddd">${d.name}</td><td style="text-align:center;border-bottom:1px solid #ddd">${d.result}</td></tr>`).join("")}</table><p style="margin-top:32px">For demonstration only. Verify before any real use.</p></div></body></html>`,
  );
  await page.screenshot({
    path: `public/samples/${sampleId}.png`,
    fullPage: true,
  });
}
await page.goto("http://127.0.0.1:5173");
await page.evaluate(() => localStorage.setItem("sehat-language", "en"));
await page.setViewportSize({ width: 1440, height: 1100 });
await page.reload();
await page.waitForTimeout(1000);
await mkdir("test-results", { recursive: true });
await page.screenshot({
  path: "test-results/report-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "test-results/report-mobile.png",
  fullPage: true,
});
await browser.close();
