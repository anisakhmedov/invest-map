import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { E2E_NAME } from "./env";

export default async function globalSetup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // CI provides DATABASE_URL directly.
  }
  const db = new PrismaClient();
  try {
    await db.user.deleteMany({ where: { fullName: E2E_NAME } });
    const role = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    const email = `e2e.${Date.now()}@example.test`;
    const password = `E2e-${randomBytes(9).toString("base64url")}-1a`;
    await db.user.create({ data: { email, fullName: E2E_NAME, passwordHash: await hashPassword(password), roleId: role.id } });
    process.env.E2E_STAFF_EMAIL = email;
    process.env.E2E_STAFF_PASSWORD = password;

    const superRole = await db.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    const superEmail = `e2e.super.${Date.now()}@example.test`;
    await db.user.create({ data: { email: superEmail, fullName: E2E_NAME, passwordHash: await hashPassword(password), roleId: superRole.id } });
    process.env.E2E_SUPER_EMAIL = superEmail;
  } finally {
    await db.$disconnect();
  }
}
