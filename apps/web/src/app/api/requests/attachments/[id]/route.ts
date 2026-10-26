import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canAccessAdmin } from "@/lib/rbac";
import { getObject } from "@/lib/s3";

// Files sent by visitors are private: only signed-in staff with access to requests can download them,
// and they always arrive as downloads rather than being displayed inside our own origin.
export async function GET(_req: Request, ctx: RouteContext<"/api/requests/attachments/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccessAdmin(user.role)) return new Response("Forbidden", { status: 403 });
  if (!can(user.role, "request", "view")) return new Response("Forbidden", { status: 403 });

  const { id } = await ctx.params;
  const file = await db.requestAttachment.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });

  try {
    const { stream, length } = await getObject(file.key);
    return new Response(stream, {
      headers: {
        "Content-Type": file.mimeType,
        ...(length !== undefined ? { "Content-Length": String(length) } : {}),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Storage unavailable", { status: 503 });
  }
}
