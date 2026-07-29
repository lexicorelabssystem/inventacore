require("dotenv").config();
const { prisma } = require("../src/prisma");
const { hashPassword } = require("../src/utils/password");

async function main() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Evitar re-hashear passwords ya hasheados
    if (user.password.startsWith("$2")) continue;

    const hashed = await hashPassword(user.password);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    console.log(`Password hasheado para ${user.email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
