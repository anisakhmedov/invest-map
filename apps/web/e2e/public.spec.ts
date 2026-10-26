import { expect, test } from "@playwright/test";
import { axeViolations, collectProblems, expectNoOverflow, locales } from "./helpers";

const paths = ["", "/about", "/map", "/projects", "/auction", "/news", "/contacts", "/request"];

for (const lang of locales) {
  test.describe(`public pages (${lang})`, () => {
    for (const path of paths) {
      test(`${path || "/"} loads cleanly`, async ({ page }) => {
        const problems = collectProblems(page);
        const res = await page.goto(`/${lang}${path}`);
        expect(res?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", /./);
        await expect(page.locator("h1")).toHaveCount(1);
        expect(problems).toEqual([]);
      });
    }
  });
}

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const lang of locales) {
    for (const path of ["", "/projects", "/auction", "/news", "/contacts", "/request", "/map"]) {
      test(`${lang}${path || "/"} light`, async ({ page }) => {
        await page.goto(`/${lang}${path}`);
        await page.waitForLoadState("networkidle");
        expect(await axeViolations(page)).toEqual([]);
      });
    }
  }

  for (const mode of ["dark", "high contrast", "large text"] as const) {
    test(`ru home, projects and request in ${mode}`, async ({ page }) => {
      await page.addInitScript((m) => {
        if (m === "dark") localStorage.setItem("theme", "dark");
        if (m === "high contrast") localStorage.setItem("a11y", JSON.stringify({ font: "md", contrast: true, motion: false }));
        if (m === "large text") localStorage.setItem("a11y", JSON.stringify({ font: "xl", contrast: false, motion: false }));
      }, mode);
      for (const path of ["", "/projects", "/request"]) {
        await page.goto(`/ru${path}`);
        await page.waitForLoadState("networkidle");
        expect(await axeViolations(page), path).toEqual([]);
      }
    });
  }
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const lang of locales) {
    for (const path of ["", "/projects", "/auction", "/news", "/contacts", "/request"]) {
      test(`${lang}${path || "/"} has no horizontal scroll`, async ({ page }) => {
        await page.goto(`/${lang}${path}`);
        await page.waitForLoadState("networkidle");
        await expectNoOverflow(page);
      });
    }
  }
});
