import { Suspense } from "react";
import Link from "next/link";
import { localeLabels, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { AccessibilityPanel } from "./accessibility-panel";
import { Select } from "@/components/form-controls";
import { NavLink } from "@/components/nav-link";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const links = [
    { href: "about", label: dict.about.title },
    { href: "map", label: dict.nav.map },
    { href: "projects", label: dict.nav.projects },
    { href: "auction", label: dict.nav.auction },
    { href: "news", label: dict.nav.news },
    { href: "contacts", label: dict.nav.contacts },
  ];
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="text-lg font-bold text-brand">
          {dict.site.name}
        </Link>
        <nav aria-label={dict.nav.mainLabel} className="order-last flex w-full gap-4 overflow-x-auto text-sm [scrollbar-width:none] sm:order-none sm:w-auto">
          {links.map((l) => (
            <NavLink key={l.href} href={`/${locale}/${l.href}`} className="whitespace-nowrap py-1 text-muted hover:text-fg">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AccessibilityPanel labels={dict.a11y} />
          <Suspense
            fallback={
              <Select
                aria-label={dict.language}
                disabled
               size="sm">
                <option>{localeLabels[locale]}</option>
              </Select>
            }
          >
            <LanguageSwitcher locale={locale} label={dict.language} />
          </Suspense>
          <ThemeToggle labels={dict.theme} />
        </div>
      </div>
    </header>
  );
}
