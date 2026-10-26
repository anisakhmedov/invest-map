export const locales = ["uz", "oz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";

export const localeLabels: Record<Locale, string> = {
  uz: "O‘zbekcha",
  oz: "Ўзбекча",
  ru: "Русский",
  en: "English",
};

// BCP 47 tags used for <html lang> and hreflang
export const htmlLang: Record<Locale, string> = {
  uz: "uz-Latn",
  oz: "uz-Cyrl",
  ru: "ru",
  en: "en",
};

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);
