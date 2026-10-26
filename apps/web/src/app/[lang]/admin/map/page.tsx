import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { MapEditor, type EditorPlan, type EditorRegion, type EditorRoad, type EditorStop } from "@/features/map/editor/map-editor";
import { cornersSchema, lineStringSchema } from "@/features/map/geo";
import { regionGeometrySchema } from "@/features/map/model";
import { AdminLoading } from "@/components/loading-states";

export default function MapEditorPage() {
  return (
    <Suspense fallback={<AdminLoading kind="map" wide />}>
      <Editor />
    </Suspense>
  );
}

const l4 = (v: unknown) => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, string>;
  return { uz: o.uz ?? "", oz: o.oz ?? "", ru: o.ru ?? "", en: o.en ?? "" };
};

async function Editor() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "map.feature", "view"), getDictionary()]);

  const [regionRows, roadRows, stopRows, planRows, imageRows] = await Promise.all([
    db.region.findMany({ orderBy: { createdAt: "asc" } }),
    db.road.findMany({ orderBy: { createdAt: "asc" } }),
    db.stop.findMany({ orderBy: { createdAt: "asc" } }),
    db.planOverlay.findMany({ orderBy: { createdAt: "asc" } }),
    db.mediaAsset.findMany({ where: { mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, filename: true } }),
  ]);

  // Rows with unreadable geometry are left out of the editor rather than breaking it.
  const regions: EditorRegion[] = regionRows.flatMap((r) => {
    const g = regionGeometrySchema.safeParse(r.geometry);
    return g.success ? [{ id: r.id, name: l4(r.name), description: l4(r.description), status: r.status, geometry: g.data }] : [];
  });
  const roads: EditorRoad[] = roadRows.flatMap((r) => {
    const g = lineStringSchema.safeParse(r.geometry);
    return g.success ? [{ id: r.id, name: l4(r.name), kind: r.kind === "rail" ? "rail" : "road", status: r.status, geometry: g.data }] : [];
  });
  const stops: EditorStop[] = stopRows.map((s) => ({
    id: s.id,
    name: l4(s.name),
    kind: s.kind === "train" ? "train" : s.kind === "other" ? "other" : "bus",
    status: s.status,
    lng: s.lng,
    lat: s.lat,
  }));
  const plans: EditorPlan[] = planRows.flatMap((p) => {
    const c = cornersSchema.safeParse(p.corners);
    return c.success ? [{ id: p.id, name: l4(p.name), status: p.status, mediaId: p.mediaId, corners: c.data, opacity: p.opacity }] : [];
  });

  const r = user.role;
  return (
    <AdminShell locale={locale} dict={dict} user={user} active="map" title={dict.admin.mapEditor.title} wide>
      <MapEditor
        lang={locale}
        locale={locale}
        dict={dict.admin}
        regions={regions}
        roads={roads}
        stops={stops}
        plans={plans}
        images={imageRows}
        perms={{
          featureCreate: can(r, "map.feature", "create"),
          featureUpdate: can(r, "map.feature", "update"),
          featureDelete: can(r, "map.feature", "delete"),
          featurePublish: can(r, "map.feature", "publish"),
          layerCreate: can(r, "map.layer", "create"),
          layerUpdate: can(r, "map.layer", "update"),
          layerDelete: can(r, "map.layer", "delete"),
          layerPublish: can(r, "map.layer", "publish"),
        }}
      />
    </AdminShell>
  );
}
