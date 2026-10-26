import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canAccessAdmin } from "@/lib/rbac";
import { toFeatureCollection } from "@/features/map/geo";

// Downloads every region, road and stop (including drafts) as GeoJSON for backup or external GIS tools.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccessAdmin(user.role)) return new Response("Forbidden", { status: 403 });
  if (!can(user.role, "map.feature", "view")) return new Response("Forbidden", { status: 403 });

  const [regions, roads, stops] = await Promise.all([
    db.region.findMany({ orderBy: { slug: "asc" } }),
    db.road.findMany({ orderBy: { slug: "asc" } }),
    db.stop.findMany({ orderBy: { slug: "asc" } }),
  ]);

  return new Response(JSON.stringify(toFeatureCollection({ regions, roads, stops })), {
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="investmap-map.geojson"',
      "Cache-Control": "no-store",
    },
  });
}
