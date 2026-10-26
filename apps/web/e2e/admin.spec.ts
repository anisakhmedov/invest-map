import { expect, test, type Page } from "@playwright/test";
import { staff, superAdmin } from "./env";
import { axeViolations } from "./helpers";

const created = { name: `e2e-created ${Date.now()}`, email: `e2e.created.${Date.now()}@example.test` };

async function signIn(page: Page) {
  const { email, password } = staff();
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/en\/admin\/?$/);
}

test.describe.serial("users and audit log", () => {
  test("an administrator opens the user list, which is accessible", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/admin/users");
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    // The rights page is for super administrators only.
    await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Roles and rights" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Audit log" })).toBeVisible();
  });

  test("creating an account checks the password and cannot hand out the top role", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/admin/users/new");
    expect(await axeViolations(page)).toEqual([]);
    await page.getByLabel("Role").click();
    await expect(page.getByRole("option", { name: "Super administrator" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByLabel("Full name").fill(created.name);
    await page.getByLabel("Email").fill(created.email);
    await page.getByLabel("Password").fill("weakpass9"); // 9 characters: the browser rejects it before the server does
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/users\/new$/);

    await page.getByLabel("Password").fill("Sturdy-pass-123");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/users\/[a-z0-9]+$/);
    await expect(page.getByLabel("Full name")).toHaveValue(created.name);
  });

  test("the new account can be found, disabled, and the change is in the audit log", async ({ page }) => {
    await signIn(page);
    await page.goto(`/en/admin/users?q=${encodeURIComponent(created.email)}`);
    await expect(page.getByRole("cell", { name: created.email })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(`Edit.*${created.name}`) }).click();
    await page.getByLabel("Account is active (can sign in)").uncheck();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toBeVisible();

    await page.goto("/en/admin/audit?action=user.");
    await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "user.update" }).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.getByText("Show").first().click();
    // The log must never contain password material.
    expect(await page.locator("pre").allTextContents()).not.toContain("Sturdy-pass-123");
    expect(await page.content()).not.toMatch(/passwordHash|scrypt/i);
  });

  test("a disabled account cannot sign in", async ({ page }) => {
    await page.goto("/en/admin/login");
    await page.getByLabel("Email").fill(created.email);
    await page.getByLabel("Password").fill("Sturdy-pass-123");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('p[role="alert"]')).toBeVisible();
  });
});

test("a super administrator sees the roles page and the top role in the form", async ({ page }) => {
  const { email, password } = superAdmin();
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/en\/admin\/?$/);

  await page.goto("/en/admin/roles");
  await expect(page.getByRole("heading", { level: 1, name: "Roles and rights" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(6);
  expect(await axeViolations(page)).toEqual([]);

  await page.goto("/en/admin/users/new");
  await page.getByLabel("Role").click();
  await expect(page.getByRole("option", { name: "Super administrator" })).toHaveCount(1);
});
