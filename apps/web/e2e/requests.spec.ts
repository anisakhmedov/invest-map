import { expect, test, type Page } from "@playwright/test";
import { staff } from "./env";
import { axeViolations, collectProblems } from "./helpers";

const subject = `[e2e] Question ${Date.now()}`;

async function signIn(page: Page) {
  const { email, password } = staff();
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/en\/admin\/?$/);
}

test.describe.serial("request flow", () => {
  let trackingPath = "";

  test("a visitor sends a request and lands on a private tracking page", async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto("/en/request");
    await page.getByLabel("Your name").fill("E2E Visitor");
    await page.getByLabel("Email").fill("visitor@example.test");
    await page.getByLabel("Subject").fill(subject);
    await page.getByLabel("Message").fill("Hello, this is an automated end-to-end test message.");
    // The form refuses to be submitted faster than a person could fill it in.
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page).toHaveURL(/\/en\/request\/track\/[\w-]{20,}/);
    trackingPath = new URL(page.url()).pathname;
    await expect(page.getByText(subject)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("the tracking page is not indexable and works only with the secret link", async ({ page, request }) => {
    await page.goto(trackingPath);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // The page is streamed, so the status line is already 200 when the lookup fails: check the content instead.
    const wrong = await request.get(`${trackingPath.slice(0, -4)}AAAA`);
    expect(await wrong.text()).not.toContain(subject);
  });

  test("a form with the hidden field filled in is silently refused", async ({ page }) => {
    await page.goto("/en/request");
    await page.getByLabel("Your name").fill("Bot Person");
    await page.getByLabel("Email").fill("bot@example.test");
    await page.getByLabel("Subject").fill("[e2e] bot subject");
    await page.getByLabel("Message").fill("Looks like a perfectly normal message to read.");
    await page.locator("#website").fill("https://spam.example");
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/request$/);
  });

  test("staff sign in, see the request and sign out", async ({ page }) => {
    await signIn(page);
    expect(await axeViolations(page)).toEqual([]);
    await page.goto("/en/admin/requests");
    await expect(page.getByText(subject)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.getByRole("link", { name: subject }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("button", { name: /sign out|log out/i }).click();
    await page.goto("/en/admin/requests");
    await expect(page).toHaveURL(/\/en\/admin\/login/);
  });
});

test("the sign-in page is accessible and rejects a wrong password without revealing which part was wrong", async ({ page }) => {
  await page.goto("/en/admin/login");
  expect(await axeViolations(page)).toEqual([]);
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  const alert = page.locator('p[role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText(/no such|not found|unknown user/i);
});
