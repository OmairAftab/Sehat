import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.SEHAT_QA_URL || "http://127.0.0.1:5173";
test("visible reporting screens meet automated WCAG checks in both languages", async ({
  page,
}) => {
  const issues: string[] = [];
  for (const { language, width } of [
    { language: "en", width: 1440 },
    { language: "ur", width: 390 },
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await page.evaluate(
      (language) => localStorage.setItem("sehat-language", language),
      language,
    );
    for (const route of ["/", "/map", "/alerts"]) {
      await page.goto(base + route);
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      for (const v of results.violations)
        issues.push(
          `${language} ${route} ${v.id}: ${v.nodes.length} nodes; ${v.nodes
            .slice(0, 4)
            .map((n) => n.target.join(" "))
            .join(", ")}`,
        );
    }
  }
  expect(issues).toEqual([]);
});
