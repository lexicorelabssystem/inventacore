// scripts/createDependency.js
require("dotenv").config();
const { prisma } = require("../src/prisma");

async function main() {
  const dep = await prisma.dependency.create({
    data: {
      name: "Sala Computacion",
      establishmentId: 1,
    },
  });

  console.log("Dependencia creada:");
  console.log(dep);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Error creando dependencia:", e);
  await prisma.$disconnect();
  process.exit(1);
});
