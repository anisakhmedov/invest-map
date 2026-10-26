import os

root = "D:/WORK/InvestMap/apps/web/"


def edit(path, pairs):
    p = root + path
    s = open(p, encoding="utf8").read()
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b, 1)
    open(p, "w", encoding="utf8").write(s)


edit("src/lib/seo.ts", [
    ('export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\\/$/, "");',
     '''/**
 * The public address of the site, used in canonical links, hreflang, the sitemap and emails.
 * Production must set it: a build that silently pointed search engines at localhost would hurt the site.
 */
export function resolveSiteUrl(value: string | undefined, production: boolean): string {
  if (!value) {
    if (production) throw new Error("NEXT_PUBLIC_SITE_URL must be set in production, e.g. https://invest.example.uz");
    return "http://localhost:3000";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("NEXT_PUBLIC_SITE_URL must start with http:// or https://");
  return url.origin;
}

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === "production");'''),
    ('export const publicPaths = ["/", "/about", "/map", "/projects", "/auction", "/news", "/contacts"] as const;', 'export const publicPaths = ["/", "/about", "/map", "/projects", "/auction", "/news", "/contacts", "/request"] as const;'),
    ('    openGraph: { locale: htmlLang[l].replace("-", "_"), url: `${SITE_URL}${localizedPath(path, l)}` },', '    openGraph: { siteName: "InvestMap", type: "website", locale: htmlLang[l].replace("-", "_"), url: `${SITE_URL}${localizedPath(path, l)}` },\n    twitter: { card: "summary_large_image" },'),
])

edit("src/app/robots.ts", [
    ('rules: [{ userAgent: "*", allow: "/", disallow: ["/*/admin", "/*/admin/"] }],', 'rules: [{ userAgent: "*", allow: "/", disallow: ["/*/admin", "/*/admin/", "/*/request/track/", "/api/"] }],'),
])

edit("src/app/[lang]/layout.tsx", [
    ('import { hasLocale, htmlLang, locales } from "@/i18n/config";', 'import { hasLocale, htmlLang, locales } from "@/i18n/config";\nimport { SITE_URL } from "@/lib/seo";'),
    ('''  return {
    title: { default: dict.site.name, template: `%s · ${dict.site.name}` },
    description: dict.site.tagline,
  };''', '''  return {
    metadataBase: new URL(SITE_URL),
    title: { default: dict.site.name, template: `%s · ${dict.site.name}` },
    description: dict.site.tagline,
    applicationName: dict.site.name,
  };'''),
])

edit("src/app/[lang]/page.tsx", [
    ('import { pageMetadata } from "@/lib/seo";', 'import { SITE_URL, pageMetadata } from "@/lib/seo";\nimport { JsonLd } from "@/components/json-ld";\nimport { htmlLang } from "@/i18n/config";'),
    ('  return (\n    <>\n      <section', '''  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: dict.site.name, url: SITE_URL, description: dict.site.tagline },
            { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: dict.site.name, url: `${SITE_URL}/${locale}`, inLanguage: htmlLang[locale], publisher: { "@id": `${SITE_URL}/#org` } },
          ],
        }}
      />
      <section'''),
])

edit("src/components/content-article.tsx", [
    ('import { pageMetadata } from "@/lib/seo";', 'import { SITE_URL, localizedPath, pageMetadata } from "@/lib/seo";\nimport { htmlLang } from "@/i18n/config";\nimport { JsonLd } from "./json-ld";'),
    ('''  return (
    <PageShell title={title.text}>''', '''  const url = `${SITE_URL}${localizedPath(`/${kind === "NEWS" ? "news" : "p"}/${slug}`, locale)}`;

  return (
    <PageShell title={title.text}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": kind === "NEWS" ? "NewsArticle" : "WebPage",
          [kind === "NEWS" ? "headline" : "name"]: title.text,
          inLanguage: htmlLang[locale],
          mainEntityOfPage: url,
          url,
          ...(page.publishedAt ? { datePublished: page.publishedAt.toISOString() } : {}),
          dateModified: page.updatedAt.toISOString(),
          publisher: { "@type": "Organization", name: dict.site.name, url: SITE_URL },
        }}
      />'''),
])

# the default Next.js favicon is replaced by the branded app/icon.tsx
fav = root + "src/app/favicon.ico"
if os.path.exists(fav):
    os.remove(fav)

# local .env files
for name in (".env", ".env.example"):
    p = root + name
    s = open(p, encoding="utf8").read()
    if "NEXT_PUBLIC_SITE_URL" not in s:
        s += '\n# Public address of the site (canonical links, sitemap, emails). Required in production.\nNEXT_PUBLIC_SITE_URL="http://127.0.0.1:3000"\n'
    open(p, "w", encoding="utf8").write(s)

# tests
p = root + "src/lib/seo.test.ts"
s = open(p, encoding="utf8").read()
s = s.replace('import { SITE_URL, buildAlternates, buildSitemap, localizedPath, pageMetadata, publicPaths } from "./seo";', 'import { SITE_URL, buildAlternates, buildSitemap, localizedPath, pageMetadata, publicPaths, resolveSiteUrl } from "./seo";')
s += '''
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
'''
open(p, "w", encoding="utf8").write(s)
print("ok")
