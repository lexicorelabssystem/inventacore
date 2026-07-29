const { loadEnv } = require("../src/config/loadEnv");
loadEnv();

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const explicitDatabaseUrl =
  argValue("--database-url") || process.env.CHECK_DATABASE_URL;

if (explicitDatabaseUrl) {
  process.env.DIRECT_DATABASE_URL = explicitDatabaseUrl;
  process.env.DATABASE_URL = explicitDatabaseUrl;
}

const databaseUrl =
  explicitDatabaseUrl ||
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL;

const { prisma } = require("../src/prisma");

async function main() {
  try {
    if (!databaseUrl) {
      throw new Error("Falta CHECK_DATABASE_URL, DIRECT_DATABASE_URL o DATABASE_URL en .env");
    }

    const [
      institutions,
      establishments,
      dependencies,
      users,
      assets,
      movements,
      catalogItems,
      supportRequests,
    ] = await Promise.all([
      prisma.institution.count(),
      prisma.establishment.count(),
      prisma.dependency.count(),
      prisma.user.count(),
      prisma.asset.count(),
      prisma.movement.count(),
      prisma.catalogItem.count(),
      prisma.supportRequest.count(),
    ]);

    console.log("DB check OK");
    console.table({
      institutions,
      establishments,
      dependencies,
      users,
      assets,
      movements,
      catalogItems,
      supportRequests,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("DB check error:", e);
});
