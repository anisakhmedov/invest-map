import { expect, test } from "@playwright/test";
import { collectProblems } from "./helpers";

test("the accessibility panel changes the page and remembers the choice", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: /accessibility/i }).click();
  await page.getByRole("checkbox", { name: /contrast/i }).check();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
});

test("the theme can be switched to dark and survives a reload", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("Theme").click();
  await page.getByRole("option", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the map draws under the production security policy", async ({ page }) => {
  const problems = collectProblems(page);
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp = [...((window as unknown as { __csp?: string[] }).__csp ?? []), `${e.violatedDirective} ${e.blockedURI}`];
    });
  });
  // Third-party tiles are not needed to prove the policy lets the map itself start.
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort());
  await page.goto("/en/map");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
  violations.push(...((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])) as string[]));
  expect(violations.filter((v) => !/tile\.openstreetmap\.org/.test(v))).toEqual([]);
  expect(problems).toEqual([]);
});

test("language switcher keeps the page and changes the language", async ({ page }) => {
  await page.goto("/en/contacts");
  await page.getByLabel("Language").click();
  await page.getByRole("option", { name: "Русский" }).click();
  await expect(page).toHaveURL(/\/ru\/contacts/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});
