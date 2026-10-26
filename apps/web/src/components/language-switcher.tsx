"use client";

import { usePathname, useRouter } from "next/navigation";
import { locales, localeLabels, htmlLang, type Locale } from "@/i18n/config";
import { Select } from "@/components/form-controls";

export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const rest = pathname.replace(/^\/[^/]+/, "");

  function change(next: string) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.push(`/${next}${rest}${window.location.search}`); // keep map filters etc.
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <Select
        value={locale}
        onChange={(e) => change(e.target.value)}
       size="sm">
        {locales.map((l) => (
          <option key={l} value={l} lang={htmlLang[l]}>
            {localeLabels[l]}
          </option>
        ))}
      </Select>
    </label>
  );
}
