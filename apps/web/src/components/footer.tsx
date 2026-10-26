import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const links = [
    { href: "about", label: dict.about.title },
    { href: "map", label: dict.nav.map },
    { href: "projects", label: dict.nav.projects },
    { href: "auction", label: dict.nav.auction },
    { href: "news", label: dict.nav.news },
    { href: "contacts", label: dict.nav.contacts },
  ];
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-serif text-xl font-semibold text-brand">{dict.site.name}</p>
          <p className="mt-2 max-w-sm text-sm text-muted">{dict.site.tagline}</p>
        </div>
        <nav aria-label={dict.footer.sections}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={`/${locale}/${l.href}`} className="text-muted hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        © {dict.site.name}. {dict.footer.rights}
      </p>
    </footer>
  );
}
