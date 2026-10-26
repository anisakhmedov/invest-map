import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { lang } from "next/root-params";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { pickLocalized, toParagraphs } from "@/lib/content";
import { formatTashkent } from "@/lib/datetime";
import { pageMetadata } from "@/lib/seo";
import { htmlLang } from "@/i18n/config";
import { getPublicAuctions, type PublicAuction } from "@/features/invest/public-data";
import { PublicLoading } from "@/components/loading-states";

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/auction", await lang(), dict.nav.auction, dict.auction.lead);
}

export default async function AuctionPage() {
  const dict = await getDictionary();
  return (
    <PageShell title={dict.nav.auction} lead={dict.auction.lead}>
      <Suspense fallback={<PublicLoading kind="cards" count={3} />}>
        <Lots />
      </Suspense>
    </PageShell>
  );
}

async function Lots() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  await connection(); // data comes from the database at request time, so building needs no database
  const { current, finished } = await getPublicAuctions();

  if (current.length === 0 && finished.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-8">
        <p className="font-semibold">{dict.auction.empty}</p>
        <p className="mt-1 text-muted">{dict.auction.emptyHint}</p>
      </div>
    );
  }

  const tag = htmlLang[locale];
  const nf = new Intl.NumberFormat(tag);
  const lot = (a: PublicAuction) => {
    const name = pickLocalized(a.object.name, locale).text;
    const terms = toParagraphs(pickLocalized(a.terms, locale).text);
    const note = pickLocalized(a.resultNote, locale).text;
    return (
      <li key={a.id} className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-serif text-xl font-semibold">{name}</h3>
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium">{dict.auction.statuses[a.status]}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{pickLocalized(a.object.regionName, locale).text}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">{dict.auction.startsAt}</dt>
            <dd className="font-semibold">{formatTashkent(a.startsAt, tag)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{dict.auction.endsAt}</dt>
            <dd className="font-semibold">{formatTashkent(a.endsAt, tag)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{dict.auction.startPrice}</dt>
            <dd className="font-semibold">${nf.format(a.startPriceUsd)}</dd>
          </div>
          {a.finalPriceUsd !== null && (
            <div>
              <dt className="text-xs text-muted">{dict.auction.finalPrice}</dt>
              <dd className="font-semibold">${nf.format(a.finalPriceUsd)}</dd>
            </div>
          )}
        </dl>
        {terms.length > 0 && (
          <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
            <p className="font-medium text-fg">{dict.auction.terms}</p>
            {terms.map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
        )}
        {note && (
          <p className="mt-4 text-sm">
            <span className="font-medium">{dict.auction.result}: </span>
            {note}
          </p>
        )}
        <Link href={`/${locale}/map?q=${encodeURIComponent(name)}`} className="mt-4 inline-block text-sm font-medium text-brand underline underline-offset-4">
          {dict.auction.viewOnMap}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-10">
      {current.length > 0 && (
        <section aria-labelledby="lots-current">
          <h2 id="lots-current" className="mb-4 font-serif text-2xl font-semibold">{dict.auction.current}</h2>
          <ul className="space-y-4">{current.map(lot)}</ul>
        </section>
      )}
      {finished.length > 0 && (
        <section aria-labelledby="lots-finished">
          <h2 id="lots-finished" className="mb-4 font-serif text-2xl font-semibold">{dict.auction.finished}</h2>
          <ul className="space-y-4">{finished.map(lot)}</ul>
        </section>
      )}
    </div>
  );
}
