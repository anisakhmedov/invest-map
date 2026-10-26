import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { pickLocalized } from "@/lib/content";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Pager } from "@/components/pager";
import { inputClass } from "@/components/admin-ui";
import { OBJECT_CATEGORIES, OBJECT_STATUSES } from "@/features/map/model";
import {
  ADMIN_SORT_KEYS,
  applyAdminQuery,
  parseAdminQuery,
  serializeAdminQuery,
  type AdminObjectRow,
  type AdminQuery,
} from "@/features/invest/admin-query";
import { removeObject } from "../invest-actions";
import { CsvImport } from "./csv-import";
import { Select } from "@/components/form-controls";
import { AdminLoading } from "@/components/loading-states";

export default function InvestAdmin({ searchParams }: PageProps<"/[lang]/admin/invest">) {
  return (
    <Suspense fallback={<AdminLoading kind="table" wide filters />}>
      <Table searchParams={searchParams} />
    </Suspense>
  );
}

async function Table({ searchParams }: { searchParams: PageProps<"/[lang]/admin/invest">["searchParams"] }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const [user, dict] = await Promise.all([requirePermission(locale, "invest", "view"), getDictionary()]);
  const t = dict.admin.invest;
  const first = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const query = parseAdminQuery({ get: first });

  const [objectRows, regions, totalInDb] = await Promise.all([
    db.investObject.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5000,
      select: { id: true, slug: true, regionId: true, name: true, category: true, status: true, areaHa: true, priceUsd: true, publish: true, updatedAt: true, region: { select: { name: true } } },
    }),
    db.region.findMany({ select: { id: true, name: true }, orderBy: { slug: "asc" } }),
    db.investObject.count(),
  ]);
  const rows: AdminObjectRow[] = objectRows.map((o) => ({
    id: o.id,
    slug: o.slug,
    regionId: o.regionId,
    regionName: o.region.name as AdminObjectRow["regionName"],
    name: o.name as AdminObjectRow["name"],
    category: o.category,
    status: o.status,
    areaHa: o.areaHa,
    priceUsd: o.priceUsd,
    publish: o.publish,
    updatedAt: o.updatedAt,
  }));
  const result = applyAdminQuery(rows, query, locale);

  const nf = new Intl.NumberFormat(htmlLang[locale]);
  const href = (over: Partial<AdminQuery>) => {
    const qs = serializeAdminQuery({ ...query, ...over });
    return `/${locale}/admin/invest${qs ? `?${qs}` : ""}`;
  };
  const sortHeader = (key: (typeof ADMIN_SORT_KEYS)[number], label: string) => {
    const active = query.sort.key === key;
    const nextDir = active && query.sort.dir === "asc" ? "desc" : "asc";
    return (
      <th scope="col" aria-sort={active ? (query.sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2 font-medium">
        <Link href={href({ sort: { key, dir: nextDir }, page: 1 })} className="hover:underline">
          {label}
          {active && <span aria-hidden> {query.sort.dir === "asc" ? "↑" : "↓"}</span>}
        </Link>
      </th>
    );
  };
  const canEdit = can(user.role, "invest", "update");
  const canDelete = can(user.role, "invest", "delete");

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="invest" title={t.title} wide>
      <div className="flex flex-wrap items-center gap-3">
        {can(user.role, "invest", "create") && (
          <Link href={`/${locale}/admin/invest/new`} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg">
            {t.new}
          </Link>
        )}
        <a href="/api/invest/export" download className="text-sm font-medium text-brand underline underline-offset-4">
          {t.export}
        </a>
      </div>

      {totalInDb > objectRows.length && (
        <p role="alert" className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          {t.truncated.replace("{shown}", String(objectRows.length)).replace("{total}", String(totalInDb))}
        </p>
      )}

      {can(user.role, "invest", "create") && <CsvImport lang={locale} labels={t.csv} errors={dict.admin.errors} />}

      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="f-q" className="mb-1 block text-sm font-medium">{t.filters.search}</label>
          <input id="f-q" name="q" defaultValue={query.q} className={inputClass} />
        </div>
        <FilterSelect id="f-region" name="region" label={t.filters.region} value={query.region} all={t.filters.all}
          options={regions.map((r) => ({ value: r.id, label: pickLocalized(r.name, locale).text }))} />
        <FilterSelect id="f-cat" name="cat" label={t.filters.category} value={query.category} all={t.filters.all}
          options={OBJECT_CATEGORIES.map((c) => ({ value: c, label: dict.map.categories[c] }))} />
        <FilterSelect id="f-status" name="status" label={t.filters.status} value={query.status} all={t.filters.all}
          options={OBJECT_STATUSES.map((s) => ({ value: s, label: dict.map.statuses[s] }))} />
        <FilterSelect id="f-publish" name="publish" label={t.filters.publish} value={query.publish} all={t.filters.all}
          options={[{ value: "PUBLISHED", label: dict.admin.common.published }, { value: "DRAFT", label: dict.admin.common.draft }]} />
        <input type="hidden" name="sort" value={query.sort.dir === "desc" ? `-${query.sort.key}` : query.sort.key} />
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg">{t.filters.apply}</button>
          <Link href={`/${locale}/admin/invest`} className="text-sm font-medium text-brand underline underline-offset-4">{t.filters.reset}</Link>
        </div>
      </form>

      {result.total === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.empty}</p>
      ) : (
        <>
          <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  {sortHeader("name", t.columns.name)}
                  {sortHeader("region", t.columns.region)}
                  {sortHeader("category", t.columns.category)}
                  {sortHeader("area", t.columns.area)}
                  {sortHeader("price", t.columns.price)}
                  {sortHeader("status", t.columns.status)}
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.publish}</th>
                  {sortHeader("updated", t.columns.updated)}
                  <th scope="col" className="px-3 py-2 font-medium">{dict.admin.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((o) => (
                  <tr key={o.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{pickLocalized(o.name, locale).text || "—"}</div>
                      <div className="text-xs text-muted">{o.slug}</div>
                    </td>
                    <td className="px-3 py-2">{pickLocalized(o.regionName, locale).text}</td>
                    <td className="px-3 py-2">{dict.map.categories[o.category as keyof typeof dict.map.categories] ?? o.category}</td>
                    <td className="px-3 py-2 tabular-nums">{nf.format(o.areaHa)}</td>
                    <td className="px-3 py-2 tabular-nums">{o.priceUsd === null ? "—" : `$${nf.format(o.priceUsd)}`}</td>
                    <td className="px-3 py-2">{dict.map.statuses[o.status as keyof typeof dict.map.statuses] ?? o.status}</td>
                    <td className="px-3 py-2">{o.publish === "PUBLISHED" ? dict.admin.common.published : dict.admin.common.draft}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Intl.DateTimeFormat(htmlLang[locale], { dateStyle: "short", timeZone: "Asia/Tashkent" }).format(o.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {canEdit && (
                          <Link href={`/${locale}/admin/invest/${o.id}`} className="font-medium text-brand underline underline-offset-4">
                            {dict.admin.common.edit}
                          </Link>
                        )}
                        {canDelete && (
                          <form action={removeObject.bind(null, locale, o.id)}>
                            <ConfirmButton message={dict.admin.common.confirmDelete} className="text-red-600 underline underline-offset-4 dark:text-red-400">
                              {dict.admin.common.delete}
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={result.page} pages={result.pages} total={result.total} hrefFor={(p) => href({ page: p })} labels={t.pager} ariaLabel={dict.nav.pagination} />
        </>
      )}
    </AdminShell>
  );
}

function FilterSelect({ id, name, label, value, all, options }: { id: string; name: string; label: string; value: string; all: string; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <Select id={id} name={name} defaultValue={value}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );
}
