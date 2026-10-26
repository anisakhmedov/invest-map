import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { PageForm } from "../page-form";
import { AdminLoading } from "@/components/loading-states";

export default function EditPageAdmin({ params }: PageProps<"/[lang]/admin/pages/[id]">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/[lang]/admin/pages/[id]">["params"] }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const [user, dict] = await Promise.all([requirePermission(locale, "page", "update"), getDictionary()]);
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="pages" title={t.pages.edit}>
      <PageForm
        lang={locale}
        id={page.id}
        initial={{
          kind: page.kind,
          slug: page.slug,
          status: page.status,
          title: page.title as Record<string, string>,
          body: page.body as Record<string, string>,
        }}
        labels={{ ...t.common, ...t.pages }}
        errors={t.errors}
        canPublish={can(user.role, "page", "publish")}
      />
    </AdminShell>
  );
}
