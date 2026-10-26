import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { PageForm } from "../page-form";
import { AdminLoading } from "@/components/loading-states";

export default function NewPageAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Form />
    </Suspense>
  );
}

async function Form() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "page", "create"), getDictionary()]);
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="pages" title={t.pages.new}>
      <PageForm
        lang={locale}
        id={null}
        initial={{ kind: "PAGE", slug: "", status: "DRAFT", title: {}, body: {} }}
        labels={{ ...t.common, ...t.pages }}
        errors={t.errors}
        canPublish={can(user.role, "page", "publish")}
      />
    </AdminShell>
  );
}
