import { describe, expect, it } from "vitest";
import { defaultLocale, hasLocale, htmlLang, localeLabels, locales } from "./config";
import uz from "./dictionaries/uz.json";
import oz from "./dictionaries/oz.json";
import ru from "./dictionaries/ru.json";
import en from "./dictionaries/en.json";

const dictionaries = { uz, oz, ru, en };

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

function leaves(obj: Record<string, unknown>): string[] {
  return Object.values(obj).flatMap((v) =>
    v && typeof v === "object" ? leaves(v as Record<string, unknown>) : [String(v)],
  );
}

describe("locale config", () => {
  it("has four locales with the default included", () => {
    expect(locales).toEqual(["uz", "oz", "ru", "en"]);
    expect(locales).toContain(defaultLocale);
  });

  it("hasLocale accepts only supported locales", () => {
    for (const l of locales) expect(hasLocale(l)).toBe(true);
    for (const bad of ["", "de", "UZ", "uz-Latn", "__proto__"]) expect(hasLocale(bad)).toBe(false);
  });

  it("provides labels and html lang for every locale", () => {
    for (const l of locales) {
      expect(localeLabels[l].length).toBeGreaterThan(0);
      expect(htmlLang[l].length).toBeGreaterThan(0);
    }
    expect(htmlLang.oz).toBe("uz-Cyrl");
  });
});

function strings(obj: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? strings(v as Record<string, unknown>, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)] as [string, string]],
  );
}

describe("dictionary placeholders", () => {
  const tokens = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
  const base = new Map(strings(uz));

  for (const l of ["oz", "ru", "en"] as const) {
    it(`${l} keeps the same {placeholders} as uz`, () => {
      for (const [key, value] of strings(dictionaries[l])) {
        expect(tokens(value), `${l}:${key}`).toEqual(tokens(base.get(key) ?? ""));
      }
    });
  }
});

describe("dictionaries", () => {
  const baseKeys = flatten(uz).sort();

  for (const l of locales) {
    it(`${l} has exactly the same keys as uz`, () => {
      expect(flatten(dictionaries[l]).sort()).toEqual(baseKeys);
    });

    it(`${l} has no empty values`, () => {
      for (const v of leaves(dictionaries[l])) expect(v.trim().length).toBeGreaterThan(0);
    });
  }

  it("oz is written in Cyrillic and uz in Latin", () => {
    expect(oz.nav.map).toMatch(/[Ѐ-ӿ]/);
    expect(uz.nav.map).not.toMatch(/[Ѐ-ӿ]/);
  });
});
