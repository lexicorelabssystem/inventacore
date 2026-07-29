require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const { prisma } = require("../src/prisma");

function argValue(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const exact = process.argv.find((arg) => arg.startsWith(prefix));
  if (exact) return exact.slice(prefix.length);

  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const next = process.argv[idx + 1];
    if (!String(next).startsWith("--")) return next;
  }

  return fallback;
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function listPublicTables(db) {
  const rows = await db.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  return rows.map((row) => String(row.tablename));
}

async function main() {
  const outDir = path.resolve(String(argValue("out-dir", "backups") || "backups"));
  const fileName = String(argValue("out", "") || "").trim();
  const tables = await listPublicTables(prisma);
  const snapshot = {
    meta: {
      createdAt: new Date().toISOString(),
      tables: tables.length,
    },
    tables: {},
  };

  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "public".${quoteIdent(table)}`);
    snapshot.tables[table] = {
      count: rows.length,
      rows,
    };
  }

  await fs.mkdir(outDir, { recursive: true });

  const outPath = fileName
    ? path.resolve(fileName)
    : path.join(outDir, `snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        tables: tables.length,
        counts: Object.fromEntries(tables.map((table) => [table, snapshot.tables[table].count])),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
