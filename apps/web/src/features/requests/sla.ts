import type { RequestStatusKey } from "./schemas";

export const DEFAULT_SLA_HOURS = 72;
export const MAX_SLA_HOURS = 24 * 60;

export function computeDueAt(createdAt: Date, hours: number): Date {
  const h = Number.isFinite(hours) && hours > 0 ? Math.min(hours, MAX_SLA_HOURS) : DEFAULT_SLA_HOURS;
  return new Date(createdAt.getTime() + h * 3_600_000);
}

/** A request is overdue when it is still being handled after its deadline. */
export function isOverdue(r: { status: RequestStatusKey; dueAt: Date }, now = new Date()): boolean {
  return (r.status === "NEW" || r.status === "IN_PROGRESS") && now.getTime() > r.dueAt.getTime();
}

/** Internal notes never change the status; a public reply marks the request as answered. */
export function statusAfterStaffMessage(current: RequestStatusKey, internal: boolean): RequestStatusKey {
  return internal ? current : "ANSWERED";
}

/** First public staff reply starts the "first response" clock reading; notes do not count. */
export function firstResponseAfter(existing: Date | null, internal: boolean, now: Date): Date | null {
  return existing ?? (internal ? null : now);
}

export type VisitorReplyOutcome = { allowed: false } | { allowed: true; status: RequestStatusKey };

/** Visitors can follow up until the request is closed; a follow-up to an answer reopens it. */
export function statusAfterVisitorMessage(current: RequestStatusKey): VisitorReplyOutcome {
  if (current === "CLOSED") return { allowed: false };
  return { allowed: true, status: current === "ANSWERED" ? "IN_PROGRESS" : current };
}
