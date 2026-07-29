// scripts/cleanup.js
require("dotenv").config();
const { prisma } = require("../src/prisma");

async function main() {
  await prisma.movement.deleteMany();
  await prisma.asset.deleteMany();
  console.log("Assets y Movements borrados");
  await prisma.$disconnect();
}

main().catch(console.error);
