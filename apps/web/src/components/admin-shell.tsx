import type { ReactNode } from "react";
import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { logout } from "@/app/[lang]/admin/actions";

type Section = "dashboard" | "pages" | "media" | "map" | "invest" | "auction" | "requests" | "tasks" | "reports" | "users" | "roles" | "audit" | "settings";

export function AdminShell({
  locale,
  dict,
  user,
  active,
  title,
  wide = false,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  user: CurrentUser;
  active: Section;
  title: string;
  /** Use the full window width, e.g. for the map editor. */
  wide?: boolean;
  children: ReactNode;
}) {
  const items: { key: Section; href: string; label: string; visible: boolean }[] = [
    { key: "dashboard", href: "", label: dict.admin.nav.dashboard, visible: true },
    { key: "pages", href: "/pages", label: dict.admin.nav.pages, visible: can(user.role, "page", "view") },
    { key: "media", href: "/media", label: dict.admin.nav.media, visible: can(user.role, "media", "view") },
    { key: "map", href: "/map", label: dict.admin.nav.map, visible: can(user.role, "map.feature", "view") },
    { key: "invest", href: "/invest", label: dict.admin.nav.invest, visible: can(user.role, "invest", "view") },
    { key: "auction", href: "/auction", label: dict.admin.nav.auction, visible: can(user.role, "auction", "view") },
    { key: "requests", href: "/requests", label: dict.admin.nav.requests, visible: can(user.role, "request", "view") },
    { key: "tasks", href: "/tasks", label: dict.admin.nav.tasks, visible: can(user.role, "task", "view") },
    { key: "reports", href: "/reports", label: dict.admin.nav.reports, visible: can(user.role, "report", "view") },
    { key: "users", href: "/users", label: dict.admin.nav.users, visible: can(user.role, "user", "view") },
    { key: "roles", href: "/roles", label: dict.admin.nav.roles, visible: can(user.role, "role", "view") },
    { key: "audit", href: "/audit", label: dict.admin.nav.audit, visible: can(user.role, "audit", "view") },
    { key: "settings", href: "/settings", label: dict.admin.nav.settings, visible: can(user.role, "settings", "view") },
  ];

  return (
    <div className={`mx-auto grid grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 lg:px-10 ${wide ? "max-w-[1700px]" : "max-w-[90rem] md:grid-cols-[220px_minmax(0,1fr)]"}`}>
      <aside className={wide ? "flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3" : undefined}>
        <nav aria-label={dict.admin.nav.label} className={`flex flex-wrap gap-2 ${wide ? "" : "md:flex-col md:gap-1"}`}>
          {items
            .filter((i) => i.visible)
            .map((i) => (
              <Link
                key={i.key}
                href={`/${locale}/admin${i.href}`}
                aria-current={i.key === active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm ${
                  i.key === active ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {i.label}
              </Link>
            ))}
        </nav>
        <div className={wide ? "flex items-center gap-3 text-sm" : "mt-6 border-t border-border pt-4 text-sm"}>
          <p className="font-medium">{user.fullName}</p>
          <p className="text-muted">{user.role}</p>
          <form action={logout.bind(null, locale)} className={wide ? "" : "mt-3"}>
            <button type="submit" className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">
              {dict.admin.logout}
            </button>
          </form>
        </div>
      </aside>
      <div>
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
