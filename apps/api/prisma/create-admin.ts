import { AdminRoleName, adminRolePermissions } from "@the-eye/shared";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/auth/crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  const passwordHash = hashPassword(password);
  const roleName = AdminRoleName.SuperAdmin;
  const permissions = adminRolePermissions[roleName];

  const role = await prisma.adminRole.upsert({
    where: { name: roleName },
    update: {
      permissions,
    },
    create: {
      name: roleName,
      permissions,
    },
  });

  const jurisdiction = await prisma.jurisdiction.upsert({
    where: {
      country_state_lga: {
        country: "Nigeria",
        state: "All",
        lga: "All",
      },
    },
    update: {},
    create: {
      name: "Nigeria - All States",
      country: "Nigeria",
      state: "All",
      lga: "All",
    },
  });

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      roleId: role.id,
      jurisdictionId: jurisdiction.id,
      displayName: "Super Admin",
      country: "Nigeria",
      state: "All",
      lga: "All",
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      roleId: role.id,
      jurisdictionId: jurisdiction.id,
      displayName: "Super Admin",
      country: "Nigeria",
      state: "All",
      lga: "All",
      isActive: true,
    },
  });

  console.log("Super admin created successfully");
  console.log("Email:", email);
  console.log("Admin ID:", admin.id);
  console.log("Role:", roleName);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
