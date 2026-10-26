import { connection } from "next/server";
import { Suspense } from "react";
import { lang } from "next/root-params";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getMapData } from "@/features/map/data";
import { MapExplorer } from "@/features/map/map-explorer";
import { parseFilters } from "@/features/map/model";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/map", await lang(), dict.nav.map, dict.home.lead);
}

export default async function MapPage({ searchParams }: PageProps<"/[lang]/map">) {
  const dict = await getDictionary();
  return (
    <>
      <h1 className="sr-only">{dict.nav.map}</h1>
      <Suspense fallback={<div className="h-[60dvh] animate-pulse bg-surface-2" aria-hidden />}>
        <Explorer searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Explorer({ searchParams }: { searchParams: PageProps<"/[lang]/map">["searchParams"] }) {
  const [locale, dict, query] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  await connection(); // data comes from the database at request time, so building needs no database
  const { regions, objects, roads, stops, plans } = await getMapData();
  const first = (k: string) => {
    const v = query[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };

  return (
    <MapExplorer
      locale={locale}
      regions={regions}
      objects={objects}
      roads={roads}
      stops={stops}
      plans={plans}
      initialFilters={parseFilters({ get: first })}
      dict={dict.map}
    />
  );
}
