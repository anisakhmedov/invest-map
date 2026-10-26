import Link from "next/link";
import { lang } from "next/root-params";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { ContourMap } from "@/components/contour-map";
import { SITE_URL, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { htmlLang } from "@/i18n/config";
import { primaryButtonClass, secondaryButtonClass } from "@/components/form-controls";

export async function generateMetadata() {
  return pageMetadata("/", await lang());
}

export default async function HomePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
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
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-6xl">
              {dict.home.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{dict.home.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/map`}
                className={primaryButtonClass}
              >
                {dict.home.openMap}
              </Link>
              <Link
                href={`/${locale}/request`}
                className={secondaryButtonClass}
              >
                {dict.home.sendRequest}
              </Link>
            </div>
          </div>
          <ContourMap className="mx-auto w-full max-w-md text-brand lg:max-w-none" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold">{dict.home.stepsTitle}</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {dict.home.steps.map((step, i) => (
            <li key={step.title} className="border-t-2 border-brand pt-4">
              <span className="font-serif text-2xl font-semibold text-brand">{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div>
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">{dict.home.ctaTitle}</h2>
            <p className="mt-2 text-muted">{dict.home.ctaText}</p>
          </div>
          <Link
            href={`/${locale}/map`}
            className={primaryButtonClass}
          >
            {dict.home.openMap}
          </Link>
        </div>
      </section>
    </>
  );
}
