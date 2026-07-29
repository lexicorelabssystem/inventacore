const { loadEnv } = require("../src/config/loadEnv");
loadEnv();

const { prisma } = require("../src/prisma");
const { relocateAsset } = require("../src/services/assetRelocateService");
const { deleteDependency } = require("../src/services/dependencyAdminService");

const ESTABLISHMENT_KEY = "LIRCAY";
const TARGET_DEPENDENCY_NAME = "POOL DE TRABAJO";
const SOURCE_RANGE = { from: 3, to: 9 };

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildPoolName(number) {
  return `POOL DE TRABAJO ${number}`;
}

async function resolveEstablishment() {
  const matches = await prisma.establishment.findMany({
    where: {
      isActive: true,
      name: { contains: ESTABLISHMENT_KEY, mode: "insensitive" },
    },
    include: {
      institution: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" },
  });
  if (matches.length === 0) {
    throw new Error(`No se encontro establecimiento que contenga "${ESTABLISHMENT_KEY}"`);
  }
  if (matches.length > 1) {
    const options = matches.map((item) => `${item.id}:${item.name}`).join(", ");
    throw new Error(`Coincidencias multiples de establecimiento: ${options}`);
  }
  return matches[0];
}

async function ensureTargetDependency(establishmentId) {
  const wanted = normalizeText(TARGET_DEPENDENCY_NAME);
  const existing = await prisma.dependency.findFirst({
    where: { establishmentId },
    orderBy: { id: "asc" },
  });

  if (existing) {
    const all = await prisma.dependency.findMany({
      where: { establishmentId },
      orderBy: { id: "asc" },
    });
    const found = all.find((item) => normalizeText(item.name) === wanted);
    if (found) {
      if (!found.isActive) {
        return prisma.dependency.update({
          where: { id: found.id },
          data: { isActive: true },
        });
      }
      return found;
    }
  }

  return prisma.dependency.create({
    data: {
      name: TARGET_DEPENDENCY_NAME,
      establishmentId,
    },
  });
}

async function resolveSourceDependencies(establishmentId) {
  const all = await prisma.dependency.findMany({
    where: { establishmentId },
    orderBy: { id: "asc" },
  });
  const byName = new Map(all.map((item) => [normalizeText(item.name), item]));
  const missing = [];
  const sources = [];

  for (let i = SOURCE_RANGE.from; i <= SOURCE_RANGE.to; i += 1) {
    const key = normalizeText(buildPoolName(i));
    const dependency = byName.get(key);
    if (!dependency) {
      missing.push(buildPoolName(i));
      continue;
    }
    sources.push(dependency);
  }

  return { sources, missing };
}

async function resolveActorUser() {
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: { type: "ADMIN_CENTRAL" },
    },
    include: { role: true },
    orderBy: { id: "asc" },
  });
  if (!user) {
    throw new Error("No hay usuario ADMIN_CENTRAL activo para ejecutar consolidacion");
  }
  return user;
}

async function main() {
  const establishment = await resolveEstablishment();
  const targetDependency = await ensureTargetDependency(establishment.id);
  const { sources, missing } = await resolveSourceDependencies(establishment.id);
  const actor = await resolveActorUser();

  if (!sources.length) {
    throw new Error("No hay sectores origen disponibles en el rango POOL DE TRABAJO 3..9");
  }

  const sourceIds = sources.map((item) => item.id).filter((id) => id !== targetDependency.id);
  const assets = await prisma.asset.findMany({
    where: {
      establishmentId: establishment.id,
      dependencyId: { in: sourceIds },
      isDeleted: false,
    },
    include: {
      dependency: { select: { id: true, name: true } },
    },
    orderBy: [{ dependencyId: "asc" }, { internalCode: "asc" }],
  });

  const moved = [];
  for (const asset of assets) {
    await relocateAsset(asset.id, targetDependency.id, actor);
    moved.push({
      internalCode: asset.internalCode,
      from: asset.dependency?.name || `ID:${asset.dependencyId}`,
      to: targetDependency.name,
    });
  }

  const deactivated = [];
  for (const source of sources) {
    if (source.id === targetDependency.id) continue;
    const activeAssets = await prisma.asset.count({
      where: { dependencyId: source.id, isDeleted: false },
    });
    if (activeAssets > 0) continue;
    if (!source.isActive) continue;
    await deleteDependency(source.id, actor);
    deactivated.push(source.name);
  }

  const targetAssets = await prisma.asset.count({
    where: {
      establishmentId: establishment.id,
      dependencyId: targetDependency.id,
      isDeleted: false,
    },
  });

  console.log("=== CONSOLIDACION POOL DE TRABAJO 3..9 -> POOL DE TRABAJO ===");
  console.log(`Establecimiento: ${establishment.name} (ID ${establishment.id})`);
  console.log(`Sector destino: ${targetDependency.name} (ID ${targetDependency.id})`);
  console.log(`Actor: ${actor.name} <${actor.email}> (ID ${actor.id})`);
  if (missing.length) {
    console.log(`Sectores origen no encontrados: ${missing.join(", ")}`);
  }
  console.log(`Activos movidos: ${moved.length}`);
  moved.forEach((row) => {
    console.log(`- INV-${row.internalCode}: ${row.from} -> ${row.to}`);
  });
  console.log(`Sectores desactivados: ${deactivated.length}${deactivated.length ? ` (${deactivated.join(", ")})` : ""}`);
  console.log(`Activos vigentes en sector destino: ${targetAssets}`);
}

main()
  .catch((error) => {
    console.error("Error consolidando pools:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
