const { loadEnv } = require("../src/config/loadEnv");
loadEnv();

const { prisma } = require("../src/prisma");
const { relocateAsset } = require("../src/services/assetRelocateService");

const TARGET_CODES = [423, 643, 644, 645, 646, 647];
const ESTABLISHMENT_MATCH = "LIRCAY";
const TARGET_DEPENDENCY_NAME = "BAÑO 4";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function resolveEstablishment() {
  const matches = await prisma.establishment.findMany({
    where: {
      isActive: true,
      name: { contains: ESTABLISHMENT_MATCH, mode: "insensitive" },
    },
    include: {
      institution: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" },
  });

  if (matches.length === 0) {
    throw new Error(`No se encontro establecimiento que contenga "${ESTABLISHMENT_MATCH}"`);
  }
  if (matches.length > 1) {
    const options = matches.map((item) => `${item.id}:${item.name}`).join(", ");
    throw new Error(`Coincidencias multiples para establecimiento: ${options}`);
  }
  return matches[0];
}

async function ensureTargetDependency(establishmentId) {
  const dependencies = await prisma.dependency.findMany({
    where: { establishmentId },
    orderBy: { name: "asc" },
  });
  const wanted = normalizeText(TARGET_DEPENDENCY_NAME);
  const existing = dependencies.find((item) => normalizeText(item.name) === wanted);

  if (!existing) {
    return prisma.dependency.create({
      data: {
        name: TARGET_DEPENDENCY_NAME,
        establishmentId,
      },
    });
  }

  if (!existing.isActive) {
    return prisma.dependency.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
  }

  return existing;
}

async function resolveActorUser() {
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: { type: "ADMIN_CENTRAL" },
    },
    include: {
      role: true,
    },
    orderBy: { id: "asc" },
  });

  if (!user) {
    throw new Error("No hay usuario activo ADMIN_CENTRAL para ejecutar reubicacion");
  }
  return user;
}

async function main() {
  const establishment = await resolveEstablishment();
  const targetDependency = await ensureTargetDependency(establishment.id);
  const actor = await resolveActorUser();

  const assets = await prisma.asset.findMany({
    where: {
      establishmentId: establishment.id,
      internalCode: { in: TARGET_CODES },
      isDeleted: false,
    },
    include: {
      dependency: { select: { id: true, name: true } },
    },
    orderBy: { internalCode: "asc" },
  });

  const foundCodes = new Set(assets.map((item) => Number(item.internalCode)));
  const missing = TARGET_CODES.filter((code) => !foundCodes.has(Number(code)));

  const moved = [];
  const already = [];

  for (const asset of assets) {
    if (asset.dependencyId === targetDependency.id) {
      already.push(asset.internalCode);
      continue;
    }

    await relocateAsset(asset.id, targetDependency.id, actor);
    moved.push({
      internalCode: asset.internalCode,
      from: asset.dependency?.name || `ID:${asset.dependencyId}`,
      to: targetDependency.name,
    });
  }

  const finalState = await prisma.asset.findMany({
    where: {
      establishmentId: establishment.id,
      internalCode: { in: TARGET_CODES },
      isDeleted: false,
    },
    include: {
      dependency: { select: { id: true, name: true } },
    },
    orderBy: { internalCode: "asc" },
  });

  console.log("=== REASIGNACION BANO 4 (LIRCAY) ===");
  console.log(`Establecimiento: ${establishment.name} (ID ${establishment.id})`);
  console.log(`Institucion: ${establishment.institution?.name || "-"} (ID ${establishment.institutionId})`);
  console.log(`Sector destino: ${targetDependency.name} (ID ${targetDependency.id})`);
  console.log(`Actor: ${actor.name} <${actor.email}> (ID ${actor.id})`);
  console.log("");
  console.log(`Movidos: ${moved.length}`);
  moved.forEach((row) => {
    console.log(`- INV-${row.internalCode}: ${row.from} -> ${row.to}`);
  });
  console.log(`Ya estaban en destino: ${already.length}${already.length ? ` (${already.join(", ")})` : ""}`);
  console.log(`No encontrados: ${missing.length}${missing.length ? ` (${missing.join(", ")})` : ""}`);
  console.log("");
  console.log("Estado final:");
  finalState.forEach((item) => {
    console.log(`- INV-${item.internalCode}: ${item.dependency?.name || "-"}`);
  });
}

main()
  .catch((error) => {
    console.error("Error en reasignacion:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
