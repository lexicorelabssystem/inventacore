require("../src/config/loadEnv").loadEnv();
const { prisma } = require("../src/prisma");

const DEFAULT_ORDER = ["ALAMEDA", "IRTA|KAI", "PEHUENCHE", "UEFA"];
const EXECUTION_CONFIRM_TEXT = "RESECUENCIAR MAU";

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const values = [];
    for (let i = idx + 1; i < process.argv.length; i += 1) {
      const token = process.argv[i];
      if (String(token).startsWith("--")) break;
      values.push(token);
    }
    if (values.length) return values.join(" ");
  }

  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`) || process.argv.some((arg) => arg.startsWith(`--${name}=`));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parsePriorityOrder(rawOrder) {
  const base = String(rawOrder || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const groups = (base.length ? base : DEFAULT_ORDER).map((entry) =>
    entry
      .split("|")
      .map((alias) => normalizeText(alias))
      .filter(Boolean)
  );
  return groups.filter((group) => group.length);
}

function getPriorityIndex(name, priorityGroups) {
  const normalized = normalizeText(name);
  const idx = priorityGroups.findIndex((group) => group.some((alias) => normalized.includes(alias)));
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function buildSequencingPlan(assets, priorityGroups) {
  const sorted = [...assets].sort((a, b) => {
    const priorityA = getPriorityIndex(a?.establishment?.name, priorityGroups);
    const priorityB = getPriorityIndex(b?.establishment?.name, priorityGroups);
    if (priorityA !== priorityB) return priorityA - priorityB;

    const estCompare = String(a?.establishment?.name || "").localeCompare(
      String(b?.establishment?.name || ""),
      "es",
      { sensitivity: "base" }
    );
    if (estCompare !== 0) return estCompare;

    const depCompare = String(a?.dependency?.name || "").localeCompare(
      String(b?.dependency?.name || ""),
      "es",
      { sensitivity: "base" }
    );
    if (depCompare !== 0) return depCompare;

    const codeDiff = Number(a?.internalCode || 0) - Number(b?.internalCode || 0);
    if (codeDiff !== 0) return codeDiff;

    return Number(a?.id || 0) - Number(b?.id || 0);
  });

  return sorted.map((asset, index) => ({
    id: asset.id,
    fromCode: Number(asset.internalCode),
    toCode: index + 1,
    establishmentName: asset?.establishment?.name || "Sin establecimiento",
    dependencyName: asset?.dependency?.name || "Sin sector",
    assetName: asset?.name || "Sin nombre",
  }));
}

async function main() {
  const execute = hasFlag("execute");
  const confirm = String(argValue("confirm", "")).trim();
  const priorityGroups = parsePriorityOrder(argValue("order", ""));

  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      internalCode: true,
      name: true,
      establishment: { select: { id: true, name: true, institutionId: true } },
      dependency: { select: { id: true, name: true } },
    },
  });

  if (!assets.length) {
    console.log("[INFO] No hay activos para resecuenciar.");
    return;
  }

  const plan = buildSequencingPlan(assets, priorityGroups);
  const maxTargetCode = plan.length;
  const changedCount = plan.filter((item) => item.fromCode !== item.toCode).length;
  const currentMaxCode = Math.max(...plan.map((item) => item.fromCode), 0);
  const tempBase = currentMaxCode + maxTargetCode + 5000;

  console.log("");
  console.log("=== Resecuencia de codigos de inventario (MAU) ===");
  console.log(`Activos totales: ${plan.length}`);
  console.log(`Activos con cambio de codigo: ${changedCount}`);
  console.log(`Orden prioritario: ${priorityGroups.map((group) => group.join("|")).join(" -> ")}`);
  console.log(`Codigo maximo objetivo: ${maxTargetCode}`);
  console.log("");
  console.log("Muestra (primeros 15):");
  console.table(
    plan.slice(0, 15).map((item) => ({
      id: item.id,
      establecimiento: item.establishmentName,
      sector: item.dependencyName,
      nombre: item.assetName,
      actual: item.fromCode,
      nuevo: item.toCode,
      actual_mau: `MAU${String(item.fromCode).padStart(7, "0")}`,
      nuevo_mau: `MAU${String(item.toCode).padStart(7, "0")}`,
    }))
  );

  if (!execute) {
    console.log("");
    console.log("[DRY RUN] No se aplicaron cambios.");
    console.log(
      `Para ejecutar usa: node scripts/resequenceAssetCodes.js --execute --confirm \"${EXECUTION_CONFIRM_TEXT}\"`
    );
    return;
  }

  if (confirm !== EXECUTION_CONFIRM_TEXT) {
    throw new Error(
      `Confirmacion invalida. Debes usar --confirm \"${EXECUTION_CONFIRM_TEXT}\" para ejecutar.`
    );
  }

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < plan.length; index += 1) {
      const row = plan[index];
      await tx.asset.update({
        where: { id: row.id },
        data: { internalCode: tempBase + index + 1 },
      });
    }

    for (let index = 0; index < plan.length; index += 1) {
      const row = plan[index];
      await tx.asset.update({
        where: { id: row.id },
        data: { internalCode: row.toCode },
      });
    }

    const institutions = await tx.institution.findMany({
      select: { id: true },
    });
    for (const institution of institutions) {
      await tx.assetSequence.upsert({
        where: { institutionId: institution.id },
        update: { lastNumber: maxTargetCode },
        create: {
          institutionId: institution.id,
          lastNumber: maxTargetCode,
        },
      });
    }
  });

  console.log("");
  console.log("[OK] Resecuencia completada.");
  console.log(`Nuevo rango: MAU0000001 .. MAU${String(maxTargetCode).padStart(7, "0")}`);
  console.log("Todas las secuencias institucionales quedaron alineadas al nuevo maximo global.");
}

main()
  .catch((error) => {
    console.error("[ERROR] No se pudo resecuenciar:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
