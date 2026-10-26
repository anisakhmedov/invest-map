import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { actions, defaultPermissions, resources, roleKeys, type Action, type Resource } from "@/lib/rbac";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { AdminLoading } from "@/components/loading-states";

export default function RolesAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="table" wide lead />}>
      <Matrix />
    </Suspense>
  );
}

async function Matrix() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "role", "view"), getDictionary()]);
  const t = dict.admin.roles;

  const counts = await db.user.groupBy({ by: ["roleId"], _count: { _all: true } });
  const roles = await db.role.findMany({ select: { id: true, key: true } });
  const countByKey = new Map(roles.map((r) => [r.key, counts.find((c) => c.roleId === r.id)?._count._all ?? 0]));

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="roles" title={t.title} wide>
      <p className="max-w-3xl text-muted">{t.lead}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roleKeys.map((key) => {
          const grant = defaultPermissions[key];
          const rows = resources.filter((r) => (grant[r]?.length ?? 0) > 0);
          return (
            <section key={key} aria-labelledby={`role-${key}`} className="rounded-xl border border-border bg-surface p-4">
              <h2 id={`role-${key}`} className="font-serif text-xl font-semibold">{t.names[key]}</h2>
              <p className="text-sm text-muted">
                {t.users}: {countByKey.get(key) ?? 0}
              </p>
              {key === "SUPER_ADMIN" ? (
                <p className="mt-3 text-sm font-medium">{t.everything}</p>
              ) : rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t.noRights}</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {rows.map((r: Resource) => (
                    <li key={r}>
                      <span className="font-medium">{t.resources[r]}:</span>{" "}
                      <span className="text-muted">{actions.filter((a: Action) => grant[r]?.includes(a)).map((a) => t.actions[a]).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
