import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const locales = ["uz", "oz", "ru", "en"] as const;

/** Console messages that are expected offline: map tiles come from a third-party server. */
const IGNORED = [/tile\.openstreetmap\.org/, /demotiles\.maplibre\.org/, /Failed to load resource/];

export function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/** WCAG 2.x A/AA violations on the current page, as short readable lines. */
export async function axeViolations(page: Page, exclude: string[] = []) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  for (const selector of exclude) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")} (${v.help})`);
}

export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal scroll").toBeLessThanOrEqual(1);
}
