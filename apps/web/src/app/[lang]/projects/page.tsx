import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { lang } from "next/root-params";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { Pager } from "@/components/pager";
import { pickLocalized } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { htmlLang } from "@/i18n/config";
import { getMapData } from "@/features/map/data";
import { OBJECT_CATEGORIES, OBJECT_STATUSES, filterObjects, parseFilters, serializeFilters, type Filters } from "@/features/map/model";
import { StatusBadge } from "@/features/map/cards";
import { paginate, parseSort, serializeSort, sortBy, type Sort } from "@/features/invest/table";
import { Select } from "@/components/form-controls";
import { PublicLoading } from "@/components/loading-states";

const SORT_KEYS = ["name", "region", "category", "area", "price", "status"] as const;
const PAGE_SIZE = 20;
const FALLBACK_SORT: Sort = { key: "name", dir: "asc" };

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/projects", await lang(), dict.nav.projects, dict.projects.lead);
}

export default async function ProjectsPage({ searchParams }: PageProps<"/[lang]/projects">) {
  const dict = await getDictionary();
  return (
    <PageShell title={dict.nav.projects} lead={dict.projects.lead}>
      <Suspense fallback={<PublicLoading kind="table" />}>
        <Table searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

const inputClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";

async function Table({ searchParams }: { searchParams: PageProps<"/[lang]/projects">["searchParams"] }) {
  const [locale, dict, params] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  const first = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const filters = parseFilters({ get: first });
  const sort = parseSort(first("sort"), SORT_KEYS, FALLBACK_SORT);
  const page = Number(first("page")) || 1;

  await connection(); // data comes from the database at request time, so building needs no database
  const { regions, objects } = await getMapData();
  const regionName = new Map(regions.map((r) => [r.id, pickLocalized(r.name, locale).text]));
  const filtered = filterObjects(objects, filters);
  const sorted = sortBy(
    filtered,
    {
      name: (o) => pickLocalized(o.name, locale).text,
      region: (o) => regionName.get(o.regionId),
      category: (o) => dict.map.categories[o.category],
      area: (o) => o.areaHa,
      price: (o) => o.priceUsd,
      status: (o) => dict.map.statuses[o.status],
    },
    sort,
  );
  const result = paginate(sorted, page, PAGE_SIZE);
  const nf = new Intl.NumberFormat(htmlLang[locale]);
  const t = dict.projects;

  const href = (over: { filters?: Filters; sort?: Sort; page?: number }) => {
    const p = new URLSearchParams(serializeFilters(over.filters ?? filters));
    const s = over.sort ?? sort;
    if (s.key !== FALLBACK_SORT.key || s.dir !== FALLBACK_SORT.dir) p.set("sort", serializeSort(s));
    if (over.page && over.page > 1) p.set("page", String(over.page));
    const qs = p.toString();
    return `/${locale}/projects${qs ? `?${qs}` : ""}`;
  };
  const head = (key: (typeof SORT_KEYS)[number], label: string) => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2 font-medium">
        <Link href={href({ sort: { key, dir: active && sort.dir === "asc" ? "desc" : "asc" } })} className="hover:underline">
          {label}
          {active && <span aria-hidden> {sort.dir === "asc" ? "↑" : "↓"}</span>}
        </Link>
      </th>
    );
  };

  return (
    <div>
      <form method="get" className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="p-q" className="mb-1 block text-sm font-medium">{dict.map.searchLabel}</label>
          <input id="p-q" name="q" defaultValue={filters.q} className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-region" className="mb-1 block text-sm font-medium">{dict.map.region}</label>
          <Select id="p-region" name="region" defaultValue={filters.region ?? ""}>
            <option value="">{t.all}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{pickLocalized(r.name, locale).text}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="p-cat" className="mb-1 block text-sm font-medium">{dict.map.category}</label>
          <Select id="p-cat" name="cat" defaultValue={filters.categories[0] ?? ""}>
            <option value="">{t.all}</option>
            {OBJECT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{dict.map.categories[c]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="p-status" className="mb-1 block text-sm font-medium">{dict.map.status}</label>
          <Select id="p-status" name="status" defaultValue={filters.statuses[0] ?? ""}>
            <option value="">{t.all}</option>
            {OBJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{dict.map.statuses[s]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="p-amin" className="mb-1 block text-sm font-medium">{dict.map.areaMin}, {dict.map.ha}</label>
          <input id="p-amin" name="areaMin" type="number" min={0} defaultValue={filters.areaMin ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-amax" className="mb-1 block text-sm font-medium">{dict.map.areaMax}, {dict.map.ha}</label>
          <input id="p-amax" name="areaMax" type="number" min={0} defaultValue={filters.areaMax ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-pmax" className="mb-1 block text-sm font-medium">{dict.map.priceMax}</label>
          <input id="p-pmax" name="priceMax" type="number" min={0} defaultValue={filters.priceMax ?? ""} className={inputClass} />
        </div>
        <input type="hidden" name="sort" value={serializeSort(sort)} />
        <div className="flex items-end gap-3">
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg">{t.apply}</button>
          <Link href={`/${locale}/projects`} className="text-sm font-medium text-brand underline underline-offset-4">{dict.map.reset}</Link>
        </div>
      </form>

      {result.total === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{dict.map.emptyList}</p>
      ) : (
        <>
          <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{dict.nav.projects}</caption>
              <thead className="bg-surface-2 text-muted">
                <tr>
                  {head("name", t.columns.name)}
                  {head("region", t.columns.region)}
                  {head("category", t.columns.category)}
                  {head("area", `${t.columns.area}, ${dict.map.ha}`)}
                  {head("price", t.columns.price)}
                  {head("status", t.columns.status)}
                  <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">{t.columns.map}</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((o) => {
                  const name = pickLocalized(o.name, locale).text;
                  return (
                    <tr key={o.id} className="border-t border-border">
                      <th scope="row" className="px-3 py-2 font-medium">{name}</th>
                      <td className="px-3 py-2">{regionName.get(o.regionId)}</td>
                      <td className="px-3 py-2">{dict.map.categories[o.category]}</td>
                      <td className="px-3 py-2 tabular-nums">{nf.format(o.areaHa)}</td>
                      <td className="px-3 py-2 tabular-nums">{o.priceUsd === null ? dict.map.priceOnRequest : `$${nf.format(o.priceUsd)}`}</td>
                      <td className="px-3 py-2"><StatusBadge status={o.status} labels={dict.map} /></td>
                      <td className="px-3 py-2">
                        <Link href={`/${locale}/map?q=${encodeURIComponent(name)}`} className="font-medium text-brand underline underline-offset-4">
                          {t.columns.map}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={result.page} pages={result.pages} total={result.total} hrefFor={(p) => href({ page: p })} labels={t.pager} ariaLabel={dict.nav.pagination} />
        </>
      )}
    </div>
  );
}
