import { Suspense } from "react";
import Link from "next/link";
import { lang } from "next/root-params";
import { db } from "@/lib/db";
import { pickLocalized, toParagraphs } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { pageMetadata } from "@/lib/seo";
import { PublicLoading } from "@/components/loading-states";

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/news", await lang(), dict.news.title, dict.news.lead);
}

export default async function NewsPage() {
  const dict = await getDictionary();
  return (
    <PageShell title={dict.news.title} lead={dict.news.lead}>
      <Suspense fallback={<PublicLoading kind="cards" count={4} />}>
        <NewsList />
      </Suspense>
    </PageShell>
  );
}

async function NewsList() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const items = await db.page.findMany({
    where: { kind: "NEWS", status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-8">
        <p className="font-semibold">{dict.news.empty}</p>
        <p className="mt-1 text-muted">{dict.news.emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {items.map((n) => {
        const title = pickLocalized(n.title, locale).text;
        const excerpt = toParagraphs(pickLocalized(n.body, locale).text)[0] ?? "";
        return (
          <li key={n.id} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-serif text-xl font-semibold">
              <Link href={`/${locale}/news/${n.slug}`} className="hover:underline">
                {title}
              </Link>
            </h2>
            {excerpt && <p className="mt-2 line-clamp-3 text-muted">{excerpt}</p>}
            <Link href={`/${locale}/news/${n.slug}`} className="mt-3 inline-block font-medium text-brand underline underline-offset-4">
              {dict.public.readMore}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
