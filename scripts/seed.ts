import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const permissions = [
    ["dashboard.read", "View dashboard"], ["invoice.create", "Create invoices"], ["invoice.issue", "Issue invoices"], ["invoice.cancel", "Cancel invoices"], ["payment.create", "Record payments"], ["master.write", "Manage masters"], ["report.read", "View reports"], ["admin.write", "Manage administration"]
  ] as const;
  for (const [key, description] of permissions) await db.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  for (const [name, description] of [["SUPER_ADMIN", "Complete system access"], ["ADMIN", "Operational administration"], ["BILLING_STAFF", "Billing operations"], ["VIEWER", "Read-only accounting access"] as const]) await db.role.upsert({ where: { name }, create: { name, description }, update: { description } });
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const companyName = process.env.SEED_COMPANY_NAME ?? "Velmayil Ventures";
  if (!adminEmail || !adminPassword) throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.");
  if (adminPassword.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  const company = await db.company.create({ data: { name: companyName, addressLine1: "Configure company address", city: "Configure city", state: "Karnataka", stateCode: "29", pinCode: "000000", invoicePrefix: "VVEL", logoUrl: "/velmayil-ventures-logo-pdf.png" } });
  const user = await db.user.upsert({ where: { email: adminEmail }, create: { companyId: company.id, name: "System Administrator", email: adminEmail, passwordHash: await hash(adminPassword, 12) }, update: { companyId: company.id, passwordHash: await hash(adminPassword, 12), status: "ACTIVE" } });
  const role = await db.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
  const rolePermissions: Record<string, string[]> = { SUPER_ADMIN: permissions.map(([key]) => key), ADMIN: permissions.filter(([key]) => key !== "admin.write").map(([key]) => key), BILLING_STAFF: ["dashboard.read", "invoice.create", "invoice.issue", "payment.create"], VIEWER: ["dashboard.read", "report.read"] };
  for (const [roleName, keys] of Object.entries(rolePermissions)) { const seededRole = await db.role.findUniqueOrThrow({ where: { name: roleName } }); for (const key of keys) { const permission = await db.permission.findUniqueOrThrow({ where: { key } }); await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: seededRole.id, permissionId: permission.id } }, create: { roleId: seededRole.id, permissionId: permission.id }, update: {} }); } }
  console.log(`Seeded company ${company.id} and administrator ${adminEmail}.`);
}

main().finally(() => db.$disconnect());
