import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { assignableRoles } from "@/features/users/policy";
import { UserForm } from "../user-form";
import { AdminLoading } from "@/components/loading-states";

export default function NewUserAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Form />
    </Suspense>
  );
}

async function Form() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "user", "create"), getDictionary()]);
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="users" title={t.users.new}>
      <UserForm
        lang={locale}
        id={null}
        initial={{ email: "", fullName: "", locale, role: "CONTENT_EDITOR", isActive: true }}
        roles={assignableRoles(user.role).map((key) => ({ key, name: t.roles.names[key] }))}
        isSelf={false}
        labels={{ ...t.common, ...t.users.fields, ...t.users }}
        errors={t.errors}
      />
    </AdminShell>
  );
}
