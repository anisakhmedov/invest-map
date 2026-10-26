import { z } from "zod";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import "./zod-config";

export type Localized = Partial<Record<Locale, string>>;

/** Returns the text for a locale, falling back to the default locale, then to any filled language. */
export function pickLocalized(value: unknown, locale: Locale): { text: string; fallback: boolean } {
  const v = (value && typeof value === "object" ? value : {}) as Localized;
  const own = v[locale]?.trim();
  if (own) return { text: own, fallback: false };
  const fallback = v[defaultLocale]?.trim() || locales.map((l) => v[l]?.trim()).find(Boolean) || "";
  return { text: fallback, fallback: fallback !== "" };
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug");

const localizedText = (max: number) =>
  z.object({
    uz: z.string().trim().max(max),
    oz: z.string().trim().max(max),
    ru: z.string().trim().max(max),
    en: z.string().trim().max(max),
  });

export const pageInputSchema = z
  .object({
    kind: z.enum(["PAGE", "NEWS"]),
    slug: slugSchema,
    status: z.enum(["DRAFT", "PUBLISHED"]),
    title: localizedText(200),
    body: localizedText(50_000),
  })
  .refine((p) => p.status === "DRAFT" || p.title.uz.length > 0, { path: ["title"], message: "title_required" });

export type PageInput = z.infer<typeof pageInputSchema>;

/** Splits plain text into paragraphs on blank lines. */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const contactsSchema = z.object({
  email: z.string().trim().max(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "email"),
  phone: z.string().trim().max(40),
  address: localizedText(300),
});

export type Contacts = z.infer<typeof contactsSchema>;
