import { PrismaClient } from "@prisma/client";
import { defaultPermissions, roleKeys } from "../src/lib/rbac";
import { hashPassword, validatePasswordStrength } from "../src/lib/password";

const db = new PrismaClient();

const roleNames: Record<(typeof roleKeys)[number], Record<string, string>> = {
  SUPER_ADMIN: { uz: "Bosh administrator", oz: "Бош администратор", ru: "Суперадминистратор", en: "Super admin" },
  ADMIN: { uz: "Administrator", oz: "Администратор", ru: "Администратор", en: "Admin" },
  CONTENT_EDITOR: { uz: "Kontent muharriri", oz: "Контент муҳаррири", ru: "Редактор контента", en: "Content editor" },
  MAP_EDITOR: { uz: "Xarita muharriri", oz: "Харита муҳаррири", ru: "Редактор карты", en: "Map editor" },
  REQUEST_MANAGER: { uz: "Murojaatlar menejeri", oz: "Мурожаатлар менежери", ru: "Менеджер обращений", en: "Request manager" },
  INVESTOR: { uz: "Investor", oz: "Инвестор", ru: "Инвестор", en: "Investor" },
};

async function main() {
  for (const key of roleKeys) {
    const role = await db.role.upsert({
      where: { key },
      update: { name: roleNames[key] },
      create: { key, name: roleNames[key] },
    });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    const rows = Object.entries(defaultPermissions[key]).flatMap(([resource, actions]) =>
      (actions ?? []).map((action) => ({ roleId: role.id, resource, action })),
    );
    if (rows.length) await db.rolePermission.createMany({ data: rows });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Roles seeded. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first super admin.");
    return;
  }
  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${weak}`);

  const role = await db.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: { email: email.toLowerCase(), fullName: "Super Admin", passwordHash: await hashPassword(password), roleId: role.id },
  });
  console.log(`Super admin ready: ${email}`);
}

main().finally(() => db.$disconnect());
