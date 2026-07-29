const { prisma } = require("../src/prisma");
const {
  buildResponsibleLookup,
  registerResponsibleInLookup,
  resolveResponsibleFromLookup,
  DEFAULT_RESPONSIBLE_ROLE,
} = require("../src/services/assetResponsibleFallbackService");

const EXECUTE_FLAG = process.argv.includes("--execute");
const CONFIRM_ARG = process.argv.find((arg) => arg.startsWith("--confirm="));
const CONFIRM_VALUE = CONFIRM_ARG ? CONFIRM_ARG.split("=")[1] : "";
const REQUIRED_CONFIRM = "ASIGNAR RESPONSABLES";

function pickFallbackResponsible(lookup, asset) {
  const resolved = resolveResponsibleFromLookup(lookup, {
    establishmentId: asset.establishmentId,
    dependencyId: asset.dependencyId,
  });
  if (!resolved?.responsibleName) return null;
  return {
    responsibleName: resolved.responsibleName,
    responsibleRut: resolved.responsibleRut || null,
    responsibleRole: resolved.responsibleRole || DEFAULT_RESPONSIBLE_ROLE,
  };
}

function normalizeMissingName(value) {
  return !String(value || "").trim();
}

async function main() {
  const [assetsWithResponsible, usersWithEstablishment, missingAssets] = await Promise.all([
    prisma.asset.findMany({
      where: {
        isDeleted: false,
        responsibleName: { not: null },
      },
      select: {
        id: true,
        establishmentId: true,
        dependencyId: true,
        responsibleName: true,
        responsibleRut: true,
        responsibleRole: true,
      },
      orderBy: [{ establishmentId: "asc" }, { dependencyId: "asc" }, { internalCode: "asc" }],
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        establishmentId: { not: null },
      },
      select: {
        establishmentId: true,
        name: true,
        role: { select: { type: true } },
      },
    }),
    prisma.asset.findMany({
      where: {
        isDeleted: false,
        OR: [{ responsibleName: null }, { responsibleName: "" }],
      },
      select: {
        id: true,
        internalCode: true,
        name: true,
        establishmentId: true,
        dependencyId: true,
        responsibleName: true,
      },
      orderBy: [{ establishmentId: "asc" }, { dependencyId: "asc" }, { internalCode: "asc" }],
    }),
  ]);

  const sanitizedAssetsWithResponsible = assetsWithResponsible.filter(
    (asset) => !normalizeMissingName(asset.responsibleName)
  );
  const lookup = buildResponsibleLookup({
    assets: sanitizedAssetsWithResponsible,
    users: usersWithEstablishment,
  });

  const updates = [];
  const unresolved = [];

  for (const asset of missingAssets) {
    const fallback = pickFallbackResponsible(lookup, asset);
    if (!fallback?.responsibleName) {
      unresolved.push(asset);
      continue;
    }
    updates.push({
      id: asset.id,
      internalCode: asset.internalCode,
      name: asset.name,
      ...fallback,
    });
    registerResponsibleInLookup(
      lookup,
      {
        establishmentId: asset.establishmentId,
        dependencyId: asset.dependencyId,
      },
      fallback
    );
  }

  console.log("Activos sin responsable:", missingAssets.length);
  console.log("Se pueden completar automaticamente:", updates.length);
  console.log("Sin fallback disponible:", unresolved.length);
  if (updates.length) {
    console.log("Ejemplos a actualizar:");
    updates.slice(0, 20).forEach((item) => {
      console.log(
        `- MAU${String(item.internalCode).padStart(7, "0")} | ${item.name} => ${item.responsibleName}`
      );
    });
  }

  if (!EXECUTE_FLAG) {
    console.log("");
    console.log("Dry-run finalizado. Para aplicar usa:");
    console.log(
      `node scripts/fillMissingAssetResponsible.js --execute --confirm="${REQUIRED_CONFIRM}"`
    );
    return;
  }

  if (CONFIRM_VALUE !== REQUIRED_CONFIRM) {
    throw new Error(
      `Confirmacion invalida. Debes usar --confirm="${REQUIRED_CONFIRM}" para ejecutar.`
    );
  }

  if (!updates.length) {
    console.log("No hay cambios para aplicar.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const item of updates) {
      await tx.asset.update({
        where: { id: item.id },
        data: {
          responsibleName: item.responsibleName,
          responsibleRut: item.responsibleRut,
          responsibleRole: item.responsibleRole,
        },
      });
    }
  });

  console.log("Actualizacion completada. Activos actualizados:", updates.length);
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
