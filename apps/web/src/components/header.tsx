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
  const navClass = "order-last flex w-full gap-1 overflow-x-auto text-sm [scrollbar-width:none] sm:order-none sm:w-auto";
  const linkClass = "whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg";
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
        <Link href={`/${locale}`} className="group flex items-center gap-2.5 rounded-lg">
          <span
            aria-hidden="true"
            className="grid size-9 place-content-center rounded-xl bg-brand text-brand-fg shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_2px_6px_-1px_oklch(0_0_0/0.25)] transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
              <circle cx="12" cy="10" r="2.3" />
            </svg>
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-fg">{dict.site.name}</span>
        </Link>
        {/* The current-page highlight reads the path on the client, so it renders behind Suspense; plain links hold its place. */}
        <Suspense fallback={<nav aria-label={dict.nav.mainLabel} className={navClass}>{links.map((l) => (
          <Link key={l.href} href={`/${locale}/${l.href}`} className={linkClass}>{l.label}</Link>
        ))}</nav>}>
          <nav aria-label={dict.nav.mainLabel} className={navClass}>
            {links.map((l) => (
              <NavLink key={l.href} href={`/${locale}/${l.href}`} className={linkClass} activeClassName="!bg-brand-soft !text-brand">
                {l.label}
              </NavLink>
            ))}
          </nav>
        </Suspense>
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
