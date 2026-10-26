import { db } from "@/lib/db";
import { ALLOWED_MIME } from "@/lib/media";
import { getObject } from "@/lib/s3";

// Public file delivery. The bucket itself stays private; only registered assets are served.
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset || !(ALLOWED_MIME as readonly string[]).includes(asset.mimeType)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { stream, length } = await getObject(asset.key);
    return new Response(stream, {
      headers: {
        "Content-Type": asset.mimeType,
        ...(length !== undefined ? { "Content-Length": String(length) } : {}),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Storage unavailable", { status: 503 });
  }
}
