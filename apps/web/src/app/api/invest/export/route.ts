import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canAccessAdmin } from "@/lib/rbac";
import { toCsv } from "@/features/invest/csv";
import { EXPORT_HEADER } from "@/features/invest/import-objects";

type Names = Record<string, string | undefined>;
const names = (v: unknown): Names => (v && typeof v === "object" ? (v as Names) : {});

// The exported file uses the same columns as the importer, so it can be edited and uploaded back.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccessAdmin(user.role)) return new Response("Forbidden", { status: 403 });
  if (!can(user.role, "invest", "view")) return new Response("Forbidden", { status: 403 });

  const objects = await db.investObject.findMany({ orderBy: { slug: "asc" }, include: { region: { select: { slug: true } } } });
  const rows = objects.map((o) => {
    const n = names(o.name);
    return [
      o.slug, o.region.slug, n.uz ?? "", n.oz ?? "", n.ru ?? "", n.en ?? "", o.category, o.status, o.areaHa, o.priceUsd,
      o.lng, o.lat, o.publish === "PUBLISHED" ? "published" : "draft", o.contactName, o.contactPhone, o.contactEmail,
    ];
  });

  return new Response(toCsv(EXPORT_HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="investmap-objects.csv"',
      "Cache-Control": "no-store",
    },
  });
}
