require("dotenv").config();
const { prisma } = require("../src/prisma");
const { hashPassword } = require("../src/utils/password");

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

function flagPresent(name) {
  return process.argv.includes(`--${name}`) || process.argv.some((arg) => arg.startsWith(`--${name}=`));
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

async function truncateAllPublicTables(db) {
  const tables = await listPublicTables(db);
  if (!tables.length) return [];

  const sql = `TRUNCATE TABLE ${tables.map((table) => `"public".${quoteIdent(table)}`).join(", ")} RESTART IDENTITY CASCADE`;
  await db.$executeRawUnsafe(sql);
  return tables;
}

async function seedMinimalCore(db, { email, password, institutionName }) {
  const passwordHash = await hashPassword(password);

  await db.role.createMany({
    data: [
      { type: "ADMIN_CENTRAL" },
      { type: "ADMIN_ESTABLISHMENT" },
      { type: "VIEWER" },
    ],
  });

  await db.assetType.createMany({
    data: [
      { name: "FIXED", minUtmValue: 3 },
      { name: "CONTROL", minUtmValue: 0 },
    ],
  });

  await db.assetState.createMany({
    data: [
      { name: "BUENO" },
      { name: "REGULAR" },
      { name: "MALO" },
      { name: "BAJA" },
    ],
  });

  const institution = await db.institution.create({
    data: { name: institutionName },
    select: { id: true, name: true },
  });

  await db.assetSequence.create({
    data: {
      institutionId: institution.id,
      lastNumber: 0,
    },
  });

  const role = await db.role.findUnique({
    where: { type: "ADMIN_CENTRAL" },
    select: { id: true },
  });
  if (!role) {
    throw new Error("No se pudo crear el rol ADMIN_CENTRAL");
  }

  const user = await db.user.create({
    data: {
      name: "Admin Central",
      email,
      password: passwordHash,
      roleId: role.id,
      institutionId: institution.id,
      establishmentId: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      institutionId: true,
      establishmentId: true,
    },
  });

  return { institution, user };
}

async function main() {
  const confirm = String(argValue("confirm", "") || "").trim();
  const dryRun = flagPresent("dry-run");
  const email = String(argValue("email", "") || "").trim().toLowerCase();
  const password = String(argValue("password", "") || "");
  const institutionName = String(argValue("institution-name", "") || "").trim();
  const expectedConfirm = "ELIMINAR TODO";

  if (confirm !== expectedConfirm) {
    throw new Error(`Debes confirmar exactamente con --confirm "${expectedConfirm}"`);
  }

  if (!email) {
    throw new Error("Debes indicar --email");
  }

  if (!password) {
    throw new Error("Debes indicar --password");
  }
  if (password.length < 12) {
    throw new Error("--password debe tener al menos 12 caracteres");
  }

  if (!institutionName) {
    throw new Error("Debes indicar --institution-name");
  }

  const existingCounts = await prisma.$transaction(async (tx) => {
    const [institutions, establishments, dependencies, users, assets, movements, supportRequests] =
      await Promise.all([
        tx.institution.count(),
        tx.establishment.count(),
        tx.dependency.count(),
        tx.user.count(),
        tx.asset.count(),
        tx.movement.count(),
        tx.supportRequest.count(),
      ]);

    return {
      institutions,
      establishments,
      dependencies,
      users,
      assets,
      movements,
      supportRequests,
    };
  });

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          confirm: expectedConfirm,
          target: {
            email,
            institutionName,
          },
          existingCounts,
        },
        null,
        2
      )
    );
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const truncatedTables = await truncateAllPublicTables(tx);
    const seeded = await seedMinimalCore(tx, { email, password, institutionName });
    return {
      truncatedTables,
      institution: seeded.institution,
      user: seeded.user,
    };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        reset: true,
        target: {
          email,
          institutionName,
        },
        truncatedTables: result.truncatedTables,
        institution: result.institution,
        user: result.user,
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


