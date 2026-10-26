import { describe, expect, it } from "vitest";
import { MAX_CSV_BYTES, MAX_CSV_ROWS, csvCell, detectDelimiter, parseCsv, toCsv } from "./csv";
import { analyzeObjectCsv, mergeLocalized, normalizeHeader, parseNumber, type RegionRef } from "./import-objects";
import { auctionInputSchema, objectInputSchema } from "./schemas";
import { paginate, parseSort, serializeSort, sortBy } from "./table";
import { PAGE_SIZE, applyAdminQuery, parseAdminQuery, serializeAdminQuery, type AdminObjectRow } from "./admin-query";

const rowsOf = (text: string) => {
  const r = parseCsv(text);
  if ("error" in r) throw new Error(r.error);
  return r.rows;
};

describe("parseCsv", () => {
  it("parses simple files with CRLF, LF and a BOM", () => {
    expect(rowsOf("﻿a,b\r\n1,2\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("handles quotes, escaped quotes, delimiters and newlines inside fields", () => {
    expect(rowsOf('a,b\n"x, y","say ""hi"""\n"line1\nline2",z')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["line1\nline2", "z"],
    ]);
  });

  it("detects semicolons and tabs but ignores delimiters inside quoted headers", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"a;b;c",d')).toBe(",");
    expect(rowsOf("a;b\n1,5;2")).toEqual([["a", "b"], ["1,5", "2"]]);
  });

  it("skips blank lines and keeps empty cells", () => {
    expect(rowsOf("a,b\n\n1,\n,\n\n2,3\n")).toEqual([["a", "b"], ["1", ""], ["2", "3"]]);
  });

  it("reports unusable input", () => {
    expect(parseCsv("")).toEqual({ error: "empty" });
    expect(parseCsv("  \n \n")).toEqual({ error: "empty" });
    expect(parseCsv('a,b\n"open,1')).toEqual({ error: "unterminated_quote" });
    expect(parseCsv("x".repeat(MAX_CSV_BYTES + 1))).toEqual({ error: "too_large" });
    const many = "a\n" + Array.from({ length: MAX_CSV_ROWS + 2 }, (_, i) => String(i)).join("\n");
    expect(parseCsv(many)).toEqual({ error: "too_many_rows" });
    const exact = "a\n" + Array.from({ length: MAX_CSV_ROWS }, (_, i) => String(i)).join("\n");
    expect("rows" in parseCsv(exact)).toBe(true);
  });
});

describe("csv export", () => {
  it("quotes only when needed", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(-3)).toBe("-3");
  });

  it("neutralises spreadsheet formulas in text", () => {
    for (const evil of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx"]) {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });

  it("round-trips through the parser", () => {
    const header = ["name", "note", "n"];
    const rows = [["Oʻzbek, zavod", 'He said "ok"', 5], ["Два\nстроки", "", 1.5]];
    const parsed = rowsOf(toCsv(header, rows));
    expect(parsed).toEqual([header, ["Oʻzbek, zavod", 'He said "ok"', "5"], ["Два\nстроки", "", "1.5"]]);
  });
});

describe("number and header parsing", () => {
  it("parses common spellings", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber(" 1 500 ")).toBe(1500);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("1,500.25")).toBe(1500.25);
    expect(parseNumber("-4.5")).toBe(-4.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("1e5")).toBeNaN();
    expect(parseNumber("1.2.3")).toBeNaN();
  });

  it("normalizes header names and aliases", () => {
    expect(normalizeHeader(" Area ")).toBe("area_ha");
    expect(normalizeHeader("﻿Name")).toBe("name_uz");
    expect(normalizeHeader("Contact Phone")).toBe("contact_phone");
    expect(normalizeHeader("price-usd")).toBe("price_usd");
    expect(normalizeHeader("Longitude")).toBe("lng");
  });
});

describe("analyzeObjectCsv", () => {
  const regions: RegionRef[] = [
    { id: "r1", slug: "toshkent", names: ["Toshkent", "Ташкент", "Tashkent"] },
    { id: "r2", slug: "fargona", names: ["Farg‘ona", "Фергана"] },
  ];
  const header = "name,region,category,area,price,lng,lat,status,publish";
  const analyze = (...lines: string[]) => {
    const r = analyzeObjectCsv(rowsOf([header, ...lines].join("\n")), regions);
    if ("fatal" in r) throw new Error(r.fatal);
    return r;
  };

  it("imports a good row with defaults", () => {
    const r = analyze("Zavod,Toshkent,industry,12.5,50000,69.2,41.3,,");
    expect(r.errors).toEqual([]);
    expect(r.objects[0].input).toMatchObject({
      regionId: "r1",
      name: { uz: "Zavod" },
      category: "industry",
      status: "AVAILABLE",
      areaHa: 12.5,
      priceUsd: 50000,
      publish: "DRAFT",
    });
    expect(r.objects[0].row).toBe(2);
  });

  it("matches regions by any name or slug, ignoring case and apostrophes", () => {
    const r = analyze("a,ТАШКЕНТ,tourism,1,,69,41,,", "b,fargona,tourism,1,,71,40,,", "c,Farg'ona,tourism,1,,71,40,,");
    expect(r.errors).toEqual([]);
    expect(r.objects.map((o) => o.input.regionId)).toEqual(["r1", "r2", "r2"]);
  });

  it("accepts text-case variants and publish flags", () => {
    const r = analyze("a,Toshkent,ENERGY,1,,69,41,auction,Yes");
    expect(r.objects[0].input).toMatchObject({ category: "energy", status: "AUCTION", publish: "PUBLISHED", priceUsd: null });
  });

  it("reports errors per row with spreadsheet row numbers and keeps the good rows", () => {
    const r = analyze(
      "ok,Toshkent,industry,1,,69,41,,",
      "bad region,Nowhere,industry,1,,69,41,,",
      "bad number,Toshkent,industry,lots,,69,41,,",
      "bad category,Toshkent,spaceships,1,,69,41,,",
      "bad coords,Toshkent,industry,1,,500,41,,",
      "bad status,Toshkent,industry,1,,69,41,maybe,",
      "zero area,Toshkent,industry,0,,69,41,,",
      ",Toshkent,industry,1,,69,41,,published",
    );
    expect(r.objects).toHaveLength(1);
    expect(r.errors).toEqual([
      { row: 3, field: "region", code: "unknown_region" },
      { row: 4, field: "area_ha", code: "invalid_number" },
      { row: 5, field: "category", code: "invalid_value" },
      { row: 6, field: "lng", code: "invalid_value" },
      { row: 7, field: "status", code: "invalid_value" },
      { row: 8, field: "areaHa", code: "invalid_value" },
      { row: 9, field: "name", code: "name_required" },
    ]);
  });

  it("flags duplicate and malformed slugs", () => {
    const r = analyzeObjectCsv(
      rowsOf("slug,name,region,category,area,lng,lat\nmy-plot,A,Toshkent,industry,1,69,41\nmy-plot,B,Toshkent,industry,1,69,41\nBad Slug,C,Toshkent,industry,1,69,41"),
      regions,
    );
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.objects).toHaveLength(1);
    expect(r.errors).toEqual([
      { row: 3, field: "slug", code: "duplicate_slug" },
      { row: 4, field: "slug", code: "invalid_slug" },
    ]);
  });

  it("fails fast on missing columns and lists ignored ones", () => {
    expect(analyzeObjectCsv(rowsOf("name,region\nA,B"), regions)).toEqual({
      fatal: "missing_columns",
      missing: ["category", "area_ha", "lng", "lat"],
    });
    const r = analyzeObjectCsv(rowsOf("name,region,category,area,lng,lat,color\nA,Toshkent,industry,1,69,41,red"), regions);
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.ignoredColumns).toEqual(["color"]);
    expect(r.columns).toContain("name_uz");
    expect(r.columns).not.toContain("publish");
  });

  it("works with semicolon files and decimal commas", () => {
    const r = analyzeObjectCsv(rowsOf("name;region;category;area;price;lng;lat\nA;Toshkent;industry;1,5;2 000;69,25;41,3"), regions);
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.errors).toEqual([]);
    expect(r.objects[0].input).toMatchObject({ areaHa: 1.5, priceUsd: 2000, lng: 69.25, lat: 41.3 });
  });
});

describe("mergeLocalized", () => {
  const incoming = { uz: "Yangi", oz: "", ru: "", en: "" };

  it("overwrites only languages that have a column in the file", () => {
    const existing = { uz: "Eski", ru: "Старый", en: "Old" };
    expect(mergeLocalized(existing, incoming, ["name_uz"], "name")).toEqual({ uz: "Yangi", oz: "", ru: "Старый", en: "Old" });
    expect(mergeLocalized(existing, incoming, ["name_uz", "name_ru"], "name")).toEqual({ uz: "Yangi", oz: "", ru: "", en: "Old" });
  });

  it("does not touch descriptions when only name columns exist, and handles junk", () => {
    expect(mergeLocalized({ uz: "Tavsif" }, incoming, ["name_uz"], "description")).toEqual({ uz: "Tavsif", oz: "", ru: "", en: "" });
    for (const junk of [null, undefined, 5, "x"]) {
      expect(mergeLocalized(junk, incoming, ["name_uz"], "name")).toEqual({ uz: "Yangi", oz: "", ru: "", en: "" });
    }
  });
});

describe("schemas", () => {
  const base = {
    regionId: "r1",
    name: { uz: "A", oz: "", ru: "", en: "" },
    description: { uz: "", oz: "", ru: "", en: "" },
    category: "industry",
    status: "AVAILABLE",
    areaHa: 1,
    priceUsd: null,
    lng: 69,
    lat: 41,
    publish: "PUBLISHED",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  };

  it("validates objects", () => {
    expect(objectInputSchema.safeParse(base).success).toBe(true);
    expect(objectInputSchema.safeParse({ ...base, contactEmail: "nope" }).success).toBe(false);
    expect(objectInputSchema.safeParse({ ...base, contactEmail: "a@b.uz" }).success).toBe(true);
    expect(objectInputSchema.safeParse({ ...base, priceUsd: -1 }).success).toBe(false);
    expect(objectInputSchema.safeParse({ ...base, areaHa: 0 }).success).toBe(false);
    expect(objectInputSchema.safeParse({ ...base, name: { ...base.name, uz: "" } }).success).toBe(false);
    expect(objectInputSchema.safeParse({ ...base, name: { ...base.name, uz: "" }, publish: "DRAFT" }).success).toBe(true);
  });

  const auction = {
    objectId: "o1",
    status: "SCHEDULED",
    publish: "DRAFT",
    startsAt: "2027-01-10T09:00:00Z",
    endsAt: "2027-01-11T09:00:00Z",
    startPriceUsd: 1000,
    terms: { uz: "", oz: "", ru: "", en: "" },
    finalPriceUsd: null,
    resultNote: { uz: "", oz: "", ru: "", en: "" },
  };

  it("validates auctions: dates, order and results", () => {
    const ok = auctionInputSchema.safeParse(auction);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.startsAt).toBeInstanceOf(Date);
    expect(auctionInputSchema.safeParse({ ...auction, endsAt: auction.startsAt }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ ...auction, endsAt: "2026-01-01T00:00:00Z" }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ ...auction, startsAt: "not a date" }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ ...auction, startsAt: "1999-01-01T00:00:00Z" }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ ...auction, startPriceUsd: 0 }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ ...auction, finalPriceUsd: 1500 }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ ...auction, status: "CLOSED", finalPriceUsd: 1500 }).success).toBe(true);
    expect(auctionInputSchema.safeParse({ ...auction, status: "FINISHED" }).success).toBe(false);
  });
});

describe("table helpers", () => {
  const items = [
    { n: "b", v: 2 },
    { n: "a", v: null as number | null },
    { n: "c", v: 1 },
    { n: "10", v: 3 },
    { n: "9", v: 3 },
  ];
  const getters = { n: (x: (typeof items)[number]) => x.n, v: (x: (typeof items)[number]) => x.v };

  it("sorts numbers numerically and strings naturally", () => {
    expect(sortBy(items, getters, { key: "v", dir: "asc" }).map((x) => x.n)).toEqual(["c", "b", "10", "9", "a"]);
    expect(sortBy(items, getters, { key: "n", dir: "asc" }).map((x) => x.n)).toEqual(["9", "10", "a", "b", "c"]);
  });

  it("keeps empty values last in both directions and is stable", () => {
    expect(sortBy(items, getters, { key: "v", dir: "desc" }).map((x) => x.n)).toEqual(["10", "9", "b", "c", "a"]);
  });

  it("ignores unknown sort keys without mutating the input", () => {
    const copy = [...items];
    expect(sortBy(items, getters, { key: "zzz", dir: "asc" })).toEqual(copy);
    expect(items).toEqual(copy);
  });

  it("parses and serializes sort params", () => {
    const fallback = { key: "n", dir: "asc" as const };
    expect(parseSort("-v", ["n", "v"], fallback)).toEqual({ key: "v", dir: "desc" });
    expect(parseSort("v", ["n", "v"], fallback)).toEqual({ key: "v", dir: "asc" });
    expect(parseSort("password", ["n", "v"], fallback)).toEqual(fallback);
    expect(parseSort(null, ["n"], fallback)).toEqual(fallback);
    expect(serializeSort({ key: "v", dir: "desc" })).toBe("-v");
  });

  it("paginates and clamps out-of-range pages", () => {
    const list = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(list, 1, 10)).toMatchObject({ page: 1, pages: 3, total: 25, items: list.slice(0, 10) });
    expect(paginate(list, 3, 10).items).toEqual([20, 21, 22, 23, 24]);
    expect(paginate(list, 99, 10).page).toBe(3);
    expect(paginate(list, -4, 10).page).toBe(1);
    expect(paginate(list, NaN, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, pages: 1, total: 0, items: [] });
  });
});

describe("admin table query", () => {
  const row = (over: Partial<AdminObjectRow>): AdminObjectRow => ({
    id: "1",
    slug: "object-1",
    regionId: "r1",
    regionName: { uz: "Toshkent" },
    name: { uz: "Zavod", ru: "Завод" },
    category: "industry",
    status: "AVAILABLE",
    areaHa: 10,
    priceUsd: 100,
    publish: "PUBLISHED",
    updatedAt: new Date("2027-01-01"),
    ...over,
  });
  const rows = [
    row({ id: "a", slug: "alpha", name: { uz: "Alfa" }, areaHa: 5, priceUsd: 300, updatedAt: new Date("2027-01-03") }),
    row({ id: "b", slug: "beta", name: { uz: "Beta" }, regionId: "r2", regionName: { uz: "Samarqand" }, category: "tourism", status: "AUCTION", areaHa: 50, priceUsd: null, publish: "DRAFT", updatedAt: new Date("2027-01-02") }),
    row({ id: "c", slug: "gamma", name: { uz: "Gamma", ru: "Гамма" }, areaHa: 20, priceUsd: 100, updatedAt: new Date("2027-01-01") }),
  ];
  const q = (qs: string) => parseAdminQuery(new URLSearchParams(qs));
  const ids = (qs: string) => applyAdminQuery(rows, q(qs), "uz").items.map((r) => r.id);

  it("defaults to newest first", () => {
    expect(ids("")).toEqual(["a", "b", "c"]);
  });

  it("filters by every field and combines filters", () => {
    expect(ids("region=r2")).toEqual(["b"]);
    expect(ids("cat=industry")).toEqual(["a", "c"]);
    expect(ids("status=AUCTION")).toEqual(["b"]);
    expect(ids("publish=DRAFT")).toEqual(["b"]);
    expect(ids("cat=industry&publish=PUBLISHED&q=gam")).toEqual(["c"]);
  });

  it("searches names in any language and slugs", () => {
    expect(ids("q=гамма")).toEqual(["c"]);
    expect(ids("q=BETA")).toEqual(["b"]);
    expect(ids("q=alpha")).toEqual(["a"]);
    expect(ids("q=zzz")).toEqual([]);
  });

  it("sorts with empty prices last in both directions", () => {
    expect(ids("sort=price")).toEqual(["c", "a", "b"]);
    expect(ids("sort=-price")).toEqual(["a", "c", "b"]);
    expect(ids("sort=-area")).toEqual(["b", "c", "a"]);
    expect(ids("sort=name")).toEqual(["a", "b", "c"]);
  });

  it("ignores junk parameters", () => {
    const parsed = q("cat=hax&status=NOPE&publish=maybe&region=<x>&sort=;drop&page=-3");
    expect(parsed).toMatchObject({ category: "", status: "", publish: "", region: "", page: 1, sort: { key: "updated", dir: "desc" } });
    expect(parseAdminQuery(new URLSearchParams({ q: "x".repeat(300) })).q).toHaveLength(100);
  });

  it("paginates and clamps the page", () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => row({ id: String(i), slug: `s${i}`, updatedAt: new Date(2027, 0, i + 1) }));
    const second = applyAdminQuery(many, q("page=2"), "uz");
    expect(second).toMatchObject({ page: 2, pages: 2, total: PAGE_SIZE + 5 });
    expect(second.items).toHaveLength(5);
    expect(applyAdminQuery(many, q("page=99"), "uz").page).toBe(2);
  });

  it("serializes only non-default values and round-trips", () => {
    expect(serializeAdminQuery(q(""))).toBe("");
    const original = q("q=zavod&region=r1&cat=energy&status=TAKEN&publish=DRAFT&sort=-area&page=3");
    expect(q(serializeAdminQuery(original))).toEqual(original);
  });
});
