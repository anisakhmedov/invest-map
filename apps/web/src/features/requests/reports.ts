import { toTashkentInput } from "@/lib/datetime";
import { REQUEST_STATUSES, type RequestStatusKey } from "./schemas";
import { isOverdue } from "./sla";

export type ReportRow = {
  createdAt: Date;
  status: RequestStatusKey;
  dueAt: Date;
  firstResponseAt: Date | null;
  closedAt: Date | null;
  regionId: string | null;
};

export type Report = {
  total: number;
  byStatus: Record<RequestStatusKey, number>;
  overdue: number;
  byMonth: { month: string; count: number }[];
  byRegion: { regionId: string | null; count: number }[];
  avgFirstResponseHours: number | null;
  /** Share of answered-or-overdue requests that got their first reply before the deadline. */
  slaMetPercent: number | null;
};

const HOUR = 3_600_000;

export function buildReport(rows: ReportRow[], now = new Date()): Report {
  const byStatus = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<RequestStatusKey, number>;
  const months = new Map<string, number>();
  const regions = new Map<string | null, number>();
  let overdue = 0;
  let responseTotal = 0;
  let responded = 0;
  let considered = 0;
  let met = 0;

  for (const r of rows) {
    byStatus[r.status]++;
    const month = toTashkentInput(r.createdAt).slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    regions.set(r.regionId, (regions.get(r.regionId) ?? 0) + 1);
    if (isOverdue(r, now)) overdue++;

    if (r.firstResponseAt) {
      responseTotal += r.firstResponseAt.getTime() - r.createdAt.getTime();
      responded++;
      considered++;
      if (r.firstResponseAt.getTime() <= r.dueAt.getTime()) met++;
    } else if (isOverdue(r, now)) {
      considered++; // still waiting and already late: counts against the target
    }
  }

  return {
    total: rows.length,
    byStatus,
    overdue,
    byMonth: [...months].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    byRegion: [...regions].map(([regionId, count]) => ({ regionId, count })).sort((a, b) => b.count - a.count),
    avgFirstResponseHours: responded ? Math.round((responseTotal / responded / HOUR) * 10) / 10 : null,
    slaMetPercent: considered ? Math.round((met / considered) * 100) : null,
  };
}

const DAY = 24 * 3_600_000;
const TASHKENT_OFFSET = 5 * 3_600_000;

function dayStart(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(utc - TASHKENT_OFFSET); // midnight in Tashkent
}

/** `from` and `to` are calendar days (YYYY-MM-DD, Tashkent time); `to` is inclusive. Bad values are ignored. */
export function parseDateRange(from: string | null | undefined, to: string | null | undefined): { from: Date | null; to: Date | null } {
  const start = dayStart(from);
  const endDay = dayStart(to);
  const end = endDay ? new Date(endDay.getTime() + DAY) : null; // exclusive upper bound
  if (start && end && end <= start) return { from: null, to: null };
  return { from: start, to: end };
}
