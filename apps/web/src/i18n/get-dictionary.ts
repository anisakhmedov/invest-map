import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";
import { loadDictionary, type Dictionary } from "./load-dictionary";

export type { Dictionary };
export { loadDictionary };

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<Dictionary> {
  return loadDictionary(await getLocale());
}
