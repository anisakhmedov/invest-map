import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { toTashkentInput } from "@/lib/datetime";
import { pickLocalized } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { AuctionForm, type AuctionFormValues } from "./auction-form";

const l4 = (v: unknown) => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, string>;
  return { uz: o.uz ?? "", oz: o.oz ?? "", ru: o.ru ?? "", en: o.en ?? "" };
};

export async function AuctionFormPage({ id }: { id: string | null }) {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "auction", id ? "update" : "create"), getDictionary()]);
  const t = dict.admin.auction;

  const [objects, auction] = await Promise.all([
    db.investObject.findMany({ select: { id: true, name: true, slug: true }, orderBy: { slug: "asc" }, take: 5000 }),
    id ? db.auction.findUnique({ where: { id } }) : null,
  ]);
  if (id && !auction) notFound();

  const initial: AuctionFormValues = auction
    ? {
        objectId: auction.objectId,
        status: auction.status,
        publish: auction.publish,
        startsAt: toTashkentInput(auction.startsAt),
        endsAt: toTashkentInput(auction.endsAt),
        startPriceUsd: String(auction.startPriceUsd),
        finalPriceUsd: auction.finalPriceUsd === null ? "" : String(auction.finalPriceUsd),
        terms: l4(auction.terms),
        resultNote: l4(auction.resultNote),
      }
    : { objectId: "", status: "SCHEDULED", publish: "DRAFT", startsAt: "", endsAt: "", startPriceUsd: "", finalPriceUsd: "", terms: l4(null), resultNote: l4(null) };

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="auction" title={id ? t.edit : t.new}>
      <AuctionForm
        lang={locale}
        id={id}
        initial={initial}
        objects={objects.map((o) => ({ id: o.id, label: pickLocalized(o.name, locale).text || o.slug }))}
        labels={t.fields}
        statuses={t.statuses}
        common={dict.admin.common}
        errors={dict.admin.errors}
        canPublish={can(user.role, "auction", "publish")}
        datePicker={dict.datePicker}
      />
    </AdminShell>
  );
}
