import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pickLocalized, toParagraphs } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { SITE_URL, localizedPath, pageMetadata } from "@/lib/seo";
import { htmlLang } from "@/i18n/config";
import { JsonLd } from "./json-ld";
import { PageShell } from "./page-shell";

/** Title, description and hreflang for a published page; unknown slugs get no metadata (the page itself 404s). */
export async function articleMetadata(kind: "PAGE" | "NEWS", slug: string) {
  const locale = await getLocale();
  const page = await db.page.findUnique({ where: { kind_slug: { kind, slug } } });
  if (!page || page.status !== "PUBLISHED") return {};
  const title = pickLocalized(page.title, locale).text;
  const description = (toParagraphs(pickLocalized(page.body, locale).text)[0] ?? "").slice(0, 160);
  return pageMetadata(`/${kind === "NEWS" ? "news" : "p"}/${slug}`, locale, title, description || undefined);
}

/** Renders a published page or news item; unknown or unpublished slugs give a 404. */
export async function ContentArticle({ kind, slug }: { kind: "PAGE" | "NEWS"; slug: string }) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const page = await db.page.findUnique({ where: { kind_slug: { kind, slug } } });
  if (!page || page.status !== "PUBLISHED") notFound();

  const title = pickLocalized(page.title, locale);
  const body = pickLocalized(page.body, locale);
  const fallback = title.fallback || body.fallback;

  const url = `${SITE_URL}${localizedPath(`/${kind === "NEWS" ? "news" : "p"}/${slug}`, locale)}`;

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
      />
      <article className="max-w-2xl space-y-4 text-lg leading-relaxed">
        {kind === "NEWS" && page.publishedAt && (
          <p className="text-sm text-muted">
            {dict.public.published}:{" "}
            <time dateTime={page.publishedAt.toISOString()}>
              {new Intl.DateTimeFormat(locale === "oz" ? "uz-Cyrl" : locale === "uz" ? "uz-Latn" : locale, {
                dateStyle: "long",
                timeZone: "Asia/Tashkent",
              }).format(page.publishedAt)}
            </time>
          </p>
        )}
        {fallback && (
          <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
            {dict.public.translationFallback}
          </p>
        )}
        {toParagraphs(body.text).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </article>
    </PageShell>
  );
}
