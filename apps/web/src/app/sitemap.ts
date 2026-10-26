import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { buildSitemap } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = await db.page
    .findMany({
      where: { status: "PUBLISHED" },
      select: { kind: true, slug: true, updatedAt: true },
    })
    .catch(() => []);

  return buildSitemap(
    published.map((p) => ({
      path: p.kind === "NEWS" ? `/news/${p.slug}` : `/p/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  );
}
