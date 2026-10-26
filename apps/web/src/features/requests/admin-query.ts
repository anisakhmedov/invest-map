import { matchesQuery } from "@/features/map/model";
import { paginate, parseSort, sortBy, type Sort } from "@/features/invest/table";
import { REQUEST_STATUSES, type RequestStatusKey } from "./schemas";
import { isOverdue } from "./sla";

export type RequestRow = {
  id: string;
  number: number;
  subject: string;
  contactName: string;
  contactEmail: string;
  status: RequestStatusKey;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: Date;
  createdAt: Date;
};

export const REQUEST_SORT_KEYS = ["number", "subject", "status", "due", "created"] as const;
export const REQUEST_PAGE_SIZE = 20;

export type RequestQuery = {
  q: string;
  status: RequestStatusKey | "";
  /** "me", "none" (unassigned) or a user id. */
  assignee: string;
  overdue: boolean;
  sort: Sort;
  page: number;
};

type Get = { get(key: string): string | null };

export function parseRequestQuery(params: Get): RequestQuery {
  const status = params.get("status") ?? "";
  const assignee = params.get("assignee") ?? "";
  const page = Number(params.get("page"));
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    status: (REQUEST_STATUSES as readonly string[]).includes(status) ? (status as RequestStatusKey) : "",
    assignee: assignee === "me" || assignee === "none" || /^[a-z0-9]{1,40}$/i.test(assignee) ? assignee : "",
    overdue: params.get("overdue") === "1",
    sort: parseSort(params.get("sort"), REQUEST_SORT_KEYS, { key: "created", dir: "desc" }),
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

export function serializeRequestQuery(q: Partial<RequestQuery>): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.status) p.set("status", q.status);
  if (q.assignee) p.set("assignee", q.assignee);
  if (q.overdue) p.set("overdue", "1");
  if (q.sort && !(q.sort.key === "created" && q.sort.dir === "desc")) p.set("sort", q.sort.dir === "desc" ? `-${q.sort.key}` : q.sort.key);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  return p.toString();
}

export function applyRequestQuery(rows: RequestRow[], query: RequestQuery, currentUserId: string, now = new Date()) {
  const number = /^#?(\d{1,9})$/.exec(query.q.trim());
  const filtered = rows.filter((r) => {
    if (query.status && r.status !== query.status) return false;
    if (query.assignee === "me" && r.assigneeId !== currentUserId) return false;
    if (query.assignee === "none" && r.assigneeId !== null) return false;
    if (query.assignee && query.assignee !== "me" && query.assignee !== "none" && r.assigneeId !== query.assignee) return false;
    if (query.overdue && !isOverdue(r, now)) return false;
    if (query.q) {
      if (number && r.number === Number(number[1])) return true;
      return matchesQuery([r.subject, r.contactName, r.contactEmail], query.q);
    }
    return true;
  });
  const sorted = sortBy(
    filtered,
    {
      number: (r) => r.number,
      subject: (r) => r.subject,
      status: (r) => REQUEST_STATUSES.indexOf(r.status),
      due: (r) => r.dueAt.getTime(),
      created: (r) => r.createdAt.getTime(),
    },
    query.sort,
  );
  return paginate(sorted, query.page, REQUEST_PAGE_SIZE);
}
