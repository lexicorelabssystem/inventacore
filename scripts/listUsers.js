// scripts/listUsers.js
require("dotenv").config();
const { prisma } = require("../src/prisma");

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      institutionId: true,
      establishmentId: true,
      role: { select: { type: true } },
    },
    orderBy: { id: "asc" },
  });

  console.table(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role?.type,
    institutionId: u.institutionId,
    establishmentId: u.establishmentId ?? null,
  })));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("listUsers error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
