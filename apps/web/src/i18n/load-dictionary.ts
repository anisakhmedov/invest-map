import type { Locale } from "./config";

// Kept free of Next.js-only imports so server actions, route handlers and tests can use it.
const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  uz: () => import("./dictionaries/uz.json").then((m) => m.default),
  oz: () => import("./dictionaries/oz.json").then((m) => m.default),
  ru: () => import("./dictionaries/ru.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export type Dictionary = typeof import("./dictionaries/uz.json");

/** For code that gets the locale as an argument instead of reading it from the URL. */
export function loadDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
