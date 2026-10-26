import type { Metadata } from "next";
import { defaultLocale, hasLocale, htmlLang, locales, type Locale } from "@/i18n/config";

/**
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

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === "production");

/** Public pages that appear in the sitemap (path without the locale prefix). */
export const publicPaths = ["/", "/about", "/map", "/projects", "/auction", "/news", "/contacts", "/request"] as const;

export function localizedPath(path: string, locale: Locale): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export function buildAlternates(path: string, locale: Locale) {
  return {
    canonical: `${SITE_URL}${localizedPath(path, locale)}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [htmlLang[l], `${SITE_URL}${localizedPath(path, l)}`])),
      "x-default": `${SITE_URL}${localizedPath(path, defaultLocale)}`,
    },
  };
}

export function pageMetadata(path: string, locale: string, title?: string, description?: string): Metadata {
  const l = hasLocale(locale) ? locale : defaultLocale;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: buildAlternates(path, l),
    openGraph: { siteName: "InvestMap", type: "website", locale: htmlLang[l].replace("-", "_"), url: `${SITE_URL}${localizedPath(path, l)}` },
    twitter: { card: "summary_large_image" },
  };
}

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  alternates: { languages: Record<string, string> };
  changeFrequency: "weekly" | "monthly";
  priority: number;
};

/** Builds sitemap entries for static pages plus extra paths (e.g. published news) in every locale. */
export function buildSitemap(extra: { path: string; lastModified?: Date }[] = []): SitemapEntry[] {
  const all = [...publicPaths.map((path) => ({ path, lastModified: undefined as Date | undefined })), ...extra];
  return all.flatMap(({ path, lastModified }) =>
    locales.map((locale) => ({
      url: `${SITE_URL}${localizedPath(path, locale)}`,
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages: buildAlternates(path, locale).languages },
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.7,
    })),
  );
}
