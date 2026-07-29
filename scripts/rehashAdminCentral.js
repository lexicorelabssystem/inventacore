// scripts/rehashAdminCentral.js
require("dotenv").config();
const { prisma } = require("../src/prisma");
const { hashPassword } = require("../src/utils/password");

async function main() {
  const email = String(process.env.REHASH_ADMIN_EMAIL || "").trim().toLowerCase();
  const newPassword = String(process.env.REHASH_ADMIN_PASSWORD || "");

  if (!email) throw new Error("Falta REHASH_ADMIN_EMAIL");
  if (newPassword.length < 12) {
    throw new Error("REHASH_ADMIN_PASSWORD debe tener al menos 12 caracteres");
  }

  const hashed = await hashPassword(newPassword);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hashed },
    include: { role: true },
  });

  console.log("Admin central re-hasheado:");
  console.log({ id: user.id, email: user.email, role: user.role.type });
}

main()
  .catch((e) => {
    console.error("Error re-hasheando admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
