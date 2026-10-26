import { db } from "@/lib/db";
import { buildReport, parseDateRange, type Report, type ReportRow } from "./reports";

export type ReportQuery = { from: string; to: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads ?from=&to= (calendar days); anything that is not a plain date is dropped. */
export function parseReportQuery(get: (key: string) => string | null): ReportQuery {
  const clean = (v: string | null) => (v && DATE.test(v) ? v : "");
  return { from: clean(get("from")), to: clean(get("to")) };
}

export async function loadReport(query: ReportQuery, now = new Date()): Promise<{ report: Report; regionNames: Map<string, unknown>; range: ReturnType<typeof parseDateRange> }> {
  const range = parseDateRange(query.from, query.to);
  const [rows, regions] = await Promise.all([
    db.request.findMany({
      where: { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } },
      select: { createdAt: true, status: true, dueAt: true, firstResponseAt: true, closedAt: true, object: { select: { regionId: true } } },
      take: 50_000,
    }),
    db.region.findMany({ select: { id: true, name: true } }),
  ]);
  const data: ReportRow[] = rows.map((r) => ({ ...r, regionId: r.object?.regionId ?? null }));
  return { report: buildReport(data, now), regionNames: new Map(regions.map((r) => [r.id, r.name])), range };
}
