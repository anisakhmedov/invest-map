export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir };

const collator = new Intl.Collator(["ru", "uz", "en"], { numeric: true, sensitivity: "base" });

/** Reads `sort=key` or `sort=-key` (descending); unknown keys fall back to the default. */
export function parseSort(value: string | null | undefined, allowed: readonly string[], fallback: Sort): Sort {
  if (!value) return fallback;
  const dir: SortDir = value.startsWith("-") ? "desc" : "asc";
  const key = value.replace(/^-/, "");
  return allowed.includes(key) ? { key, dir } : fallback;
}

export function serializeSort(s: Sort): string {
  return s.dir === "desc" ? `-${s.key}` : s.key;
}

/** Stable sort with empty values always last, whichever the direction. */
export function sortBy<T>(items: T[], getters: Record<string, (item: T) => string | number | null | undefined>, sort: Sort): T[] {
  const get = getters[sort.key];
  if (!get) return [...items];
  const sign = sort.dir === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, v: get(item) }))
    .sort((a, b) => {
      const aEmpty = a.v === null || a.v === undefined || a.v === "";
      const bEmpty = b.v === null || b.v === undefined || b.v === "";
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const cmp = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : collator.compare(String(a.v), String(b.v));
      return cmp !== 0 ? cmp * sign : a.index - b.index;
    })
    .map((x) => x.item);
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)), pages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pages, total: items.length };
}
