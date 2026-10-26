import type { Prisma } from "@prisma/client";

export type AuditInput = {
  userId?: string | null;
  action: string; // e.g. "page.update"
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

const SENSITIVE = new Set(["password", "passwordhash", "token", "secret"]);

/** Removes secrets from snapshots so they never reach the audit log. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE.has(k.toLowerCase()) ? "[redacted]" : redact(v)]),
    );
  }
  return value;
}

export function buildAuditEntry(input: AuditInput) {
  return {
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before: (input.before === undefined ? undefined : redact(input.before)) as Prisma.InputJsonValue | undefined,
    after: (input.after === undefined ? undefined : redact(input.after)) as Prisma.InputJsonValue | undefined,
    ip: input.ip ?? null,
  };
}
