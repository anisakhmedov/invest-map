import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canAccessAdmin } from "@/lib/rbac";
import { buildAuditEntry } from "@/lib/audit";
import { requestIp } from "@/lib/request-ip";
import { toCsv } from "@/features/invest/csv";
import { parseReportQuery } from "@/features/requests/report-data";
import { parseDateRange } from "@/features/requests/reports";
import { isOverdue } from "@/features/requests/sla";

// One row per request in the chosen period, for spreadsheets. Personal data is included, so access is limited to staff.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccessAdmin(user.role)) return new Response("Forbidden", { status: 403 });
  if (!can(user.role, "report", "view") || !can(user.role, "request", "view")) return new Response("Forbidden", { status: 403 });

  const params = new URL(req.url).searchParams;
  const query = parseReportQuery((k) => params.get(k));
  const range = parseDateRange(query.from, query.to);
  const rows = await db.request.findMany({
    where: { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } },
    orderBy: { number: "asc" },
    take: 50_000,
    include: { assignee: { select: { fullName: true } }, object: { select: { region: { select: { slug: true } } } } },
  });

  const iso = (d: Date | null) => (d ? d.toISOString() : "");
  const now = new Date();
  const body = toCsv(
    ["number", "created_at", "status", "subject", "contact_name", "contact_email", "region", "assignee", "due_at", "first_response_at", "closed_at", "overdue"],
    rows.map((r) => [
      r.number, iso(r.createdAt), r.status, r.subject, r.contactName, r.contactEmail, r.object?.region.slug ?? "", r.assignee?.fullName ?? "",
      iso(r.dueAt), iso(r.firstResponseAt), iso(r.closedAt), isOverdue(r, now) ? "yes" : "no",
    ]),
  );
  // The file holds visitors' personal data, so every download is on record.
  await db.auditLog.create({
    data: buildAuditEntry({ userId: user.id, action: "report.export", entity: "Request", after: { rows: rows.length, from: query.from, to: query.to }, ip: await requestIp() }),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="investmap-requests.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
