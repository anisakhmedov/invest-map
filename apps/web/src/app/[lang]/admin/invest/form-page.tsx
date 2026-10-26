import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { pickLocalized } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { ObjectForm, type ObjectFormValues } from "./object-form";

const l4 = (v: unknown) => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, string>;
  return { uz: o.uz ?? "", oz: o.oz ?? "", ru: o.ru ?? "", en: o.en ?? "" };
};

/** Shared by the "new" and "edit" pages: loads lookups and renders the form inside the admin shell. */
export async function ObjectFormPage({ id }: { id: string | null }) {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "invest", id ? "update" : "create"), getDictionary()]);
  const t = dict.admin.invest;

  const [regions, files, object] = await Promise.all([
    db.region.findMany({ select: { id: true, name: true }, orderBy: { slug: "asc" } }),
    db.mediaAsset.findMany({ select: { id: true, filename: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    id ? db.investObject.findUnique({ where: { id }, include: { documents: { select: { id: true } } } }) : null,
  ]);
  if (id && !object) notFound();

  const initial: ObjectFormValues = object
    ? {
        regionId: object.regionId,
        name: l4(object.name),
        description: l4(object.description),
        category: object.category,
        status: object.status,
        areaHa: String(object.areaHa),
        priceUsd: object.priceUsd === null ? "" : String(object.priceUsd),
        lng: String(object.lng),
        lat: String(object.lat),
        publish: object.publish,
        contactName: object.contactName ?? "",
        contactPhone: object.contactPhone ?? "",
        contactEmail: object.contactEmail ?? "",
        documentIds: object.documents.map((d) => d.id),
      }
    : {
        regionId: "",
        name: l4(null),
        description: l4(null),
        category: "industry",
        status: "AVAILABLE",
        areaHa: "",
        priceUsd: "",
        lng: "",
        lat: "",
        publish: "DRAFT",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        documentIds: [],
      };

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="invest" title={id ? t.edit : t.new}>
      <ObjectForm
        lang={locale}
        id={id}
        initial={initial}
        regions={regions.map((r) => ({ id: r.id, label: pickLocalized(r.name, locale).text }))}
        files={files.map((f) => ({ id: f.id, label: f.filename }))}
        labels={t.fields}
        common={dict.admin.common}
        categories={dict.map.categories}
        statuses={dict.map.statuses}
        errors={dict.admin.errors}
        canPublish={can(user.role, "invest", "publish")}
      />
    </AdminShell>
  );
}
