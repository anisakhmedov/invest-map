import { expect, test } from "@playwright/test";

test("security headers are sent with a strict policy", async ({ request }) => {
  const res = await request.get("/ru");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBeTruthy();
  const csp = h["content-security-policy"] ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  expect(h["strict-transport-security"]).toBeTruthy();
});

test("the admin area and staff-only downloads need a login", async ({ page, request }) => {
  await page.goto("/ru/admin/requests");
  await expect(page).toHaveURL(/\/ru\/admin\/login/);
  for (const path of ["/api/invest/export", "/api/map/export", "/api/reports/requests"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([401, 403, 307, 308], path).toContain(res.status());
  }
});

test("private pages are kept out of search engines", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /*/admin");
  expect(robots).toContain("Disallow: /api/");
});

test("SEO basics: canonical, hreflang, Open Graph, JSON-LD, manifest, icon", async ({ page, request }) => {
  await page.goto("/en");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
  expect(ld["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(["Organization", "WebSite"]);
  expect((await request.get("/manifest.webmanifest")).status()).toBe(200);
  expect((await request.get("/icon")).headers()["content-type"]).toContain("image/png");
  expect((await request.get("/en/opengraph-image")).headers()["content-type"]).toContain("image/png");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/ru/request");
});
