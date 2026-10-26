import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { SITE_URL, buildAlternates, buildSitemap, localizedPath, pageMetadata, publicPaths, resolveSiteUrl } from "./seo";
import robots from "@/app/robots";

describe("seo helpers", () => {
  it("builds localized paths", () => {
    expect(localizedPath("/", "ru")).toBe("/ru");
    expect(localizedPath("/news", "oz")).toBe("/oz/news");
  });

  it("adds hreflang for every locale plus x-default", () => {
    const alt = buildAlternates("/about", "en");
    expect(alt.canonical).toBe(`${SITE_URL}/en/about`);
    expect(Object.keys(alt.languages).sort()).toEqual(["en", "ru", "uz-Cyrl", "uz-Latn", "x-default"]);
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/uz/about`);
  });

  it("falls back to the default locale for unknown ones", () => {
    expect(pageMetadata("/", "xx").alternates?.canonical).toBe(`${SITE_URL}/uz`);
  });
});

describe("sitemap and robots", () => {
  const entries = buildSitemap();

  it("lists every public path in every locale exactly once", () => {
    expect(entries).toHaveLength(publicPaths.length * locales.length);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
  });

  it("never includes admin pages", () => {
    expect(entries.some((e) => e.url.includes("/admin"))).toBe(false);
  });

  it("adds dynamic pages in every locale with lastModified", () => {
    const d = new Date(0);
    const withNews = buildSitemap([{ path: "/news/hello", lastModified: d }]);
    expect(withNews).toHaveLength((publicPaths.length + 1) * locales.length);
    const item = withNews.find((e) => e.url === `${SITE_URL}/ru/news/hello`);
    expect(item?.lastModified).toBe(d);
    expect(Object.keys(item!.alternates.languages)).toContain("uz-Cyrl");
  });

  it("robots blocks admin and points to the sitemap", () => {
    const r = robots();
    expect(JSON.stringify(r.rules)).toContain("/*/admin");
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("resolveSiteUrl", () => {
  it("falls back to localhost only outside production", () => {
    expect(resolveSiteUrl(undefined, false)).toBe("http://localhost:3000");
    expect(() => resolveSiteUrl(undefined, true)).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => resolveSiteUrl("", true)).toThrow();
  });

  it("normalizes the address to its origin", () => {
    expect(resolveSiteUrl("https://invest.example.uz/", true)).toBe("https://invest.example.uz");
    expect(resolveSiteUrl("https://invest.example.uz/some/path?x=1", true)).toBe("https://invest.example.uz");
    expect(resolveSiteUrl("http://127.0.0.1:3100", false)).toBe("http://127.0.0.1:3100");
  });

  it("rejects values that are not web addresses", () => {
    for (const bad of ["invest.example.uz", "javascript:alert(1)", "ftp://x.uz", "not a url"]) {
      expect(() => resolveSiteUrl(bad, false)).toThrow();
    }
  });
});

describe("social cards and robots", () => {
  it("sets the site name, type and a large summary card", () => {
    const m = pageMetadata("/about", "ru", "About");
    expect(m.openGraph).toMatchObject({ siteName: "InvestMap", type: "website", locale: "ru" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps private paths out of search engines", () => {
    const rules = JSON.stringify(robots().rules);
    for (const p of ["/*/admin", "/*/request/track/", "/api/"]) expect(rules).toContain(p);
  });

  it("lists the request form in the sitemap in every language", () => {
    const urls = buildSitemap().map((e) => e.url);
    for (const l of locales) expect(urls).toContain(`${SITE_URL}/${l}/request`);
  });
});
