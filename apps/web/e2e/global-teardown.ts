import { PrismaClient } from "@prisma/client";
import { E2E_NAME } from "./env";

export default async function globalTeardown() {
  const db = new PrismaClient();
  try {
    const users = await db.user.findMany({ where: { fullName: E2E_NAME }, select: { id: true } });
    const ids = users.map((u) => u.id);
    const made = await db.user.findMany({ where: { fullName: { startsWith: "e2e-created" } }, select: { id: true } });
    const all = [...ids, ...made.map((u) => u.id)];
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: all } }, { entityId: { in: all } }] } });
    await db.user.deleteMany({ where: { id: { in: all } } });
    await db.request.deleteMany({ where: { subject: { startsWith: "[e2e]" } } });
  } finally {
    await db.$disconnect();
  }
}
