require("dotenv").config();
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

function isTransientUser(user) {
  const name = String(user?.name || "");
  const email = String(user?.email || "");
  return /(qa|test|demo)/i.test(name) || /(qa|test|demo)/i.test(email);
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

  const sql = `TRUNCATE TABLE ${tables
    .map((table) => `"public".${quoteIdent(table)}`)
    .join(", ")} RESTART IDENTITY CASCADE`;
  await db.$executeRawUnsafe(sql);
  return tables;
}

async function loadUsersToPreserve() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      isActive: true,
      role: { select: { type: true } },
      photo: {
        select: {
          mimeType: true,
          content: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const preservedUsers = users.filter((user) => !isTransientUser(user));
  const removedUsers = users.filter((user) => isTransientUser(user));

  return {
    preservedUsers,
    removedUsers,
  };
}

async function seedMinimalCore(db, institutionName, preservedUsers) {
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
    data: {
      name: institutionName,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  await db.assetSequence.create({
    data: {
      institutionId: institution.id,
      lastNumber: 0,
    },
  });

  const roleMap = new Map(
    (
      await db.role.findMany({
        select: { id: true, type: true },
      })
    ).map((role) => [role.type, role.id])
  );

  const recreatedUsers = [];

  for (const user of preservedUsers) {
    const roleId = roleMap.get(user.role?.type || "VIEWER");
    if (!roleId) {
      throw new Error(`No existe rol para ${user.role?.type || "VIEWER"}`);
    }

    const createdUser = await db.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        roleId,
        institutionId: institution.id,
        establishmentId: null,
        isActive: user.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (user.photo?.content?.length) {
      await db.userPhoto.create({
        data: {
          userId: createdUser.id,
          mimeType: user.photo.mimeType,
          content: user.photo.content,
        },
      });
    }

    recreatedUsers.push(createdUser);
  }

  return {
    institution,
    recreatedUsers,
  };
}

async function main() {
  const confirm = String(argValue("confirm", "") || "").trim();
  const expectedConfirm = "ELIMINAR TODO";
  const institutionName = String(
    argValue("institution-name", "Subsecretar\u00eda de la Ni\u00f1ez") || ""
  ).trim();

  if (confirm !== expectedConfirm) {
    throw new Error(`Debes confirmar exactamente con --confirm "${expectedConfirm}"`);
  }

  if (!institutionName) {
    throw new Error("Debes indicar --institution-name");
  }

  const { preservedUsers, removedUsers } = await loadUsersToPreserve();
  if (!preservedUsers.length) {
    throw new Error(
      "No hay usuarios reales para preservar. Cancelo el reset para no dejar el sistema sin acceso."
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const truncatedTables = await truncateAllPublicTables(tx);
    const seeded = await seedMinimalCore(tx, institutionName, preservedUsers);
    return {
      truncatedTables,
      institution: seeded.institution,
      recreatedUsers: seeded.recreatedUsers,
    };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        reset: true,
        institution: result.institution,
        preservedUsers: result.recreatedUsers,
        removedUsers: removedUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })),
        truncatedTables: result.truncatedTables,
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
