import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { assignableRoles, canManageRole } from "@/features/users/policy";
import { UserForm } from "../user-form";
import { AdminLoading } from "@/components/loading-states";

export default function EditUserAdmin({ params }: PageProps<"/[lang]/admin/users/[id]">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/[lang]/admin/users/[id]">["params"] }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const [user, dict] = await Promise.all([requirePermission(locale, "user", "update"), getDictionary()]);
  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  // An admin cannot even open a super admin's account.
  if (!target || !canManageRole(user.role, target.role.key)) notFound();
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="users" title={t.users.edit}>
      <UserForm
        lang={locale}
        id={target.id}
        initial={{ email: target.email, fullName: target.fullName, locale: target.locale, role: target.role.key, isActive: target.isActive }}
        roles={assignableRoles(user.role).map((key) => ({ key, name: t.roles.names[key] }))}
        isSelf={target.id === user.id}
        labels={{ ...t.common, ...t.users.fields, ...t.users }}
        errors={t.errors}
      />
    </AdminShell>
  );
}
