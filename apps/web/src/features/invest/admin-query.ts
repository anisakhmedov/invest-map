import { pickLocalized } from "@/lib/content";
import type { Locale } from "@/i18n/config";
import { OBJECT_CATEGORIES, OBJECT_STATUSES, matchesQuery, nameVariants, type ObjectCategory, type ObjectStatusKey } from "@/features/map/model";
import { paginate, parseSort, sortBy, type Sort } from "./table";

export type AdminObjectRow = {
  id: string;
  slug: string;
  regionId: string;
  regionName: Partial<Record<Locale, string>>;
  name: Partial<Record<Locale, string>>;
  category: string;
  status: string;
  areaHa: number;
  priceUsd: number | null;
  publish: "DRAFT" | "PUBLISHED";
  updatedAt: Date;
};

export const ADMIN_SORT_KEYS = ["name", "region", "category", "area", "price", "status", "updated"] as const;
export const PAGE_SIZE = 20;

export type AdminQuery = {
  q: string;
  region: string;
  category: ObjectCategory | "";
  status: ObjectStatusKey | "";
  publish: "DRAFT" | "PUBLISHED" | "";
  sort: Sort;
  page: number;
};

type Get = { get(key: string): string | null };

export function parseAdminQuery(params: Get): AdminQuery {
  const category = params.get("cat") ?? "";
  const status = params.get("status") ?? "";
  const publish = params.get("publish") ?? "";
  const page = Number(params.get("page"));
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    region: /^[a-z0-9]{1,40}$/i.test(params.get("region") ?? "") ? (params.get("region") as string) : "",
    category: (OBJECT_CATEGORIES as readonly string[]).includes(category) ? (category as ObjectCategory) : "",
    status: (OBJECT_STATUSES as readonly string[]).includes(status) ? (status as ObjectStatusKey) : "",
    publish: publish === "DRAFT" || publish === "PUBLISHED" ? publish : "",
    sort: parseSort(params.get("sort"), ADMIN_SORT_KEYS, { key: "updated", dir: "desc" }),
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/** Only non-default values are written, so URLs stay short and shareable. */
export function serializeAdminQuery(q: Partial<AdminQuery>): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.region) p.set("region", q.region);
  if (q.category) p.set("cat", q.category);
  if (q.status) p.set("status", q.status);
  if (q.publish) p.set("publish", q.publish);
  if (q.sort && !(q.sort.key === "updated" && q.sort.dir === "desc")) p.set("sort", q.sort.dir === "desc" ? `-${q.sort.key}` : q.sort.key);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  return p.toString();
}

export function applyAdminQuery(rows: AdminObjectRow[], query: AdminQuery, locale: Locale) {
  const filtered = rows.filter(
    (r) =>
      (!query.region || r.regionId === query.region) &&
      (!query.category || r.category === query.category) &&
      (!query.status || r.status === query.status) &&
      (!query.publish || r.publish === query.publish) &&
      (!query.q || matchesQuery([...nameVariants(r.name), r.slug], query.q)),
  );
  const sorted = sortBy(
    filtered,
    {
      name: (r) => pickLocalized(r.name, locale).text,
      region: (r) => pickLocalized(r.regionName, locale).text,
      category: (r) => r.category,
      area: (r) => r.areaHa,
      price: (r) => r.priceUsd,
      status: (r) => r.status,
      updated: (r) => r.updatedAt.getTime(),
    },
    query.sort,
  );
  return paginate(sorted, query.page, PAGE_SIZE);
}
