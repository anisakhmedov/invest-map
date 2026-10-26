// Tiny diagnostic: checks that the database answers a read and a write.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
try {
  const [{ now }] = await db.$queryRaw`SELECT now() AS now`;
  console.log("read ok", now.toISOString());
  await db.$executeRaw`CREATE TEMP TABLE _ping (x int)`;
  await db.$executeRaw`INSERT INTO _ping SELECT generate_series(1, 1000)`;
  console.log("write ok");
} catch (e) {
  console.log("FAILED:", e.code ?? "", String(e.message).split("\n").slice(-3).join(" | ").slice(0, 300));
} finally {
  await db.$disconnect();
}
