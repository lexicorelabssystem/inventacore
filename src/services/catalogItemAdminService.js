const { Prisma } = require("@prisma/client");
const { prisma } = require("../prisma");
const ExcelJS = require("exceljs");
const { forbidden, notFound, conflict, badRequest } = require("../utils/httpError");
const { logAdminAudit } = require("./adminAuditService");
const {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildCatalogItemForceDeleteSummary,
} = require("./adminForceDeleteService");

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede administrar catalogo");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function catalogCompositeKey(item) {
  return [
    norm(item.name),
    norm(item.category),
    norm(item.subcategory),
    norm(item.brand),
    norm(item.modelName),
  ].join("::");
}

function normalizeOfficialKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, "").toUpperCase();
}

function extractOfficialKeyFromDescription(description) {
  const raw = String(description || "");
  const match = raw.match(/\bCodigo:\s*([^\s|]+)/i);
  return normalizeOfficialKey(match ? match[1] : null);
}

function buildDedupeKeys(item) {
  const composite = `COMPOSITE::${catalogCompositeKey(item)}`;
  const official = normalizeOfficialKey(item.officialKey);
  if (!official) return [composite];
  return [`OFFICIAL::${official}`, composite];
}

function normalizeCatalogItemInput(item) {
  return {
    name: String(item.name || "").trim(),
    category: String(item.category || "").trim(),
    subcategory: item.subcategory ? String(item.subcategory).trim() : null,
    brand: item.brand ? String(item.brand).trim() : null,
    modelName: item.modelName ? String(item.modelName).trim() : null,
    description: item.description ? String(item.description).trim() : null,
    unit: item.unit ? String(item.unit).trim() : null,
    officialKey: normalizeOfficialKey(item.officialKey),
  };
}

function buildCompositeWhere(item) {
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    brand: item.brand,
    modelName: item.modelName,
  };
}

const DEDUPE_POLICY = {
  primary: "officialKey (si viene en Excel: OFFICIAL_KEY / CODIGO_ACTIVO / CODIGO)",
  fallback: "name+category+subcategory+brand+modelName (normalizados)",
};

const CATALOG_CONFLICT_CODES = {
  DUPLICATE_OFFICIAL_KEY: "CATALOG_ITEM_DUPLICATE_OFFICIAL_KEY",
  DUPLICATE_COMPOSITE: "CATALOG_ITEM_DUPLICATE_COMPOSITE",
  HAS_ASSETS: "CATALOG_ITEM_HAS_ASSETS",
};

function throwCatalogDuplicateConflict(byOfficial, officialKey) {
  throw conflict(
    byOfficial
      ? `CatalogItem duplicado por officialKey (${officialKey})`
      : "CatalogItem duplicado por nombre/categoria/subcategoria/marca/modelo",
    byOfficial
      ? CATALOG_CONFLICT_CODES.DUPLICATE_OFFICIAL_KEY
      : CATALOG_CONFLICT_CODES.DUPLICATE_COMPOSITE
  );
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function cleanCell(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if (value.text) return String(value.text).trim() || null;
    if (value.result !== undefined && value.result !== null) {
      return String(value.result).trim() || null;
    }
    return null;
  }
  const v = String(value).trim();
  return v || null;
}

function pick(row, map, keys) {
  for (const key of keys) {
    const idx = map[normalizeHeader(key)];
    if (idx === undefined) continue;
    const value = cleanCell(row.getCell(idx).value);
    if (value) return value;
  }
  return null;
}

async function listCatalogItems(query, user) {
  requireCentral(user);
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = (query.q || "").trim();

  const where = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.subcategory ? { subcategory: query.subcategory } : {}),
    ...(query.brand ? { brand: query.brand } : {}),
    ...(query.modelName ? { modelName: query.modelName } : {}),
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { subcategory: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { modelName: { contains: q, mode: "insensitive" } },
      { officialKey: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.catalogItem.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    skip,
  });
  const total = await prisma.catalogItem.count({ where });
  return { total, skip, take, items };
}

async function getCatalogItem(id, user) {
  requireCentral(user);
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) throw notFound("CatalogItem no existe");
  return item;
}

async function checkOfficialKeyAvailability(query, user) {
  requireCentral(user);
  const normalized = normalizeOfficialKey(query.officialKey);
  if (!normalized) {
    return { available: false, normalizedOfficialKey: null, conflictItem: null };
  }

  const where = query.excludeId
    ? { officialKey: normalized, id: { not: Number(query.excludeId) } }
    : { officialKey: normalized };

  const found = await prisma.catalogItem.findFirst({
    where,
    select: { id: true, name: true, category: true, officialKey: true },
  });

  return {
    available: !found,
    normalizedOfficialKey: normalized,
    conflictItem: found || null,
  };
}

async function createCatalogItem(data, user) {
  requireCentral(user);
  const normalized = normalizeCatalogItemInput(data);
  const compositeWhere = buildCompositeWhere(normalized);
  const or = [compositeWhere];
  if (normalized.officialKey) {
    or.unshift({ officialKey: normalized.officialKey });
  }
  const exists = await prisma.catalogItem.findFirst({
    where: { OR: or },
  });
  if (exists) {
    const byOfficial =
      normalized.officialKey && normalizeOfficialKey(exists.officialKey) === normalized.officialKey;
    throwCatalogDuplicateConflict(byOfficial, normalized.officialKey);
  }
  let created;
  try {
    created = await prisma.catalogItem.create({ data: normalized });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      err.meta.target.includes("officialKey")
    ) {
      throwCatalogDuplicateConflict(true, normalized.officialKey || "UNKNOWN");
    }
    throw err;
  }
  await logAdminAudit({
    userId: user.id,
    entityType: "CATALOG_ITEM",
    action: "CREATE",
    entityId: created.id,
    before: null,
    after: created,
  });
  return created;
}

async function updateCatalogItem(id, data, user) {
  requireCentral(user);
  const exists = await prisma.catalogItem.findUnique({ where: { id } });
  if (!exists) throw notFound("CatalogItem no existe");

  const candidate = normalizeCatalogItemInput({
    ...exists,
    ...data,
    officialKey: data.officialKey !== undefined ? data.officialKey : exists.officialKey,
  });
  const compositeWhere = buildCompositeWhere(candidate);
  const or = [compositeWhere];
  if (candidate.officialKey) {
    or.unshift({ officialKey: candidate.officialKey });
  }
  const duplicate = await prisma.catalogItem.findFirst({
    where: {
      id: { not: id },
      OR: or,
    },
  });
  if (duplicate) {
    const byOfficial =
      candidate.officialKey && normalizeOfficialKey(duplicate.officialKey) === candidate.officialKey;
    throwCatalogDuplicateConflict(byOfficial, candidate.officialKey);
  }

  const updateData = { ...data };
  if (data.officialKey !== undefined) {
    updateData.officialKey = normalizeOfficialKey(data.officialKey);
  }
  let updated;
  try {
    updated = await prisma.catalogItem.update({ where: { id }, data: updateData });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      err.meta.target.includes("officialKey")
    ) {
      const attemptedOfficialKey =
        updateData.officialKey !== undefined
          ? normalizeOfficialKey(updateData.officialKey)
          : candidate.officialKey;
      throwCatalogDuplicateConflict(true, attemptedOfficialKey || "UNKNOWN");
    }
    throw err;
  }
  await logAdminAudit({
    userId: user.id,
    entityType: "CATALOG_ITEM",
    action: "UPDATE",
    entityId: updated.id,
    before: exists,
    after: updated,
  });
  return updated;
}

async function deleteCatalogItem(id, user) {
  requireCentral(user);
  const exists = await prisma.catalogItem.findUnique({ where: { id } });
  if (!exists) throw notFound("CatalogItem no existe");
  const count = await prisma.asset.count({ where: { catalogItemId: id } });
  if (count > 0) {
    throw conflict(
      "No se puede eliminar: hay assets asociados",
      CATALOG_CONFLICT_CODES.HAS_ASSETS
    );
  }
  const deleted = await prisma.catalogItem.delete({ where: { id } });
  await logAdminAudit({
    userId: user.id,
    entityType: "CATALOG_ITEM",
    action: "DELETE",
    entityId: deleted.id,
    before: exists,
    after: null,
  });
  return deleted;
}

async function getCatalogItemForceDeleteSummary(id, user) {
  requireCentral(user);
  const exists = await prisma.catalogItem.findUnique({ where: { id } });
  if (!exists) throw notFound("CatalogItem no existe");
  const summary = await buildCatalogItemForceDeleteSummary(prisma, id);
  return {
    entityType: "CATALOG_ITEM",
    entityId: id,
    entityName: exists.name,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    summary,
  };
}

async function deleteCatalogItemPermanentForce(id, data, user) {
  requireCentral(user);
  const exists = await prisma.catalogItem.findUnique({ where: { id } });
  if (!exists) throw notFound("CatalogItem no existe");
  if (String(data?.confirmationText || "").trim() !== FORCE_DELETE_CONFIRMATION_TEXT) {
    throw badRequest(
      `Debes confirmar con el texto exacto: ${FORCE_DELETE_CONFIRMATION_TEXT}`,
      "FORCE_DELETE_CONFIRMATION_INVALID"
    );
  }
  const summary = await buildCatalogItemForceDeleteSummary(prisma, id);

  await prisma.$transaction(async (tx) => {
    await tx.asset.updateMany({
      where: { catalogItemId: id },
      data: { catalogItemId: null },
    });
    await tx.catalogItem.delete({ where: { id } });
    await logAdminAudit({
      userId: user.id,
      entityType: "CATALOG_ITEM",
      action: "DELETE",
      entityId: id,
      before: exists,
      after: {
        hardDeleted: true,
        forced: true,
        deletedSummary: summary,
      },
      db: tx,
    });
  });

  return {
    id,
    hardDeleted: true,
    forced: true,
    summary,
  };
}

async function purgeCatalogAndResetSequence(user) {
  requireCentral(user);
  const beforeCount = await prisma.catalogItem.count();

  await prisma.$transaction(async (tx) => {
    await tx.asset.updateMany({
      where: { catalogItemId: { not: null } },
      data: { catalogItemId: null },
    });
    await tx.catalogItem.deleteMany({});
    await tx.$executeRawUnsafe('ALTER SEQUENCE "CatalogItem_id_seq" RESTART WITH 1');
    await logAdminAudit({
      userId: user.id,
      entityType: "CATALOG_ITEM",
      action: "DELETE",
      entityId: 0,
      before: { count: beforeCount },
      after: { count: 0, resetSequence: "CatalogItem_id_seq" },
      db: tx,
    });
  });

  return {
    purged: true,
    deletedCount: beforeCount,
    catalogCount: 0,
    sequenceRestartedTo: 1,
  };
}

async function createCatalogItemsBulk(data, user) {
  requireCentral(user);
  const items = data.items || [];
  const normalized = [];
  const skipped = [];
  const seen = new Set();

  for (const item of items) {
    const normalizedItem = normalizeCatalogItemInput(item);
    const dedupeKeys = buildDedupeKeys(normalizedItem);
    const duplicatedInInput = dedupeKeys.find((key) => seen.has(key));
    if (duplicatedInInput) {
      skipped.push({
        ...item,
        reason: "DUPLICATE_IN_INPUT",
        dedupeBy: duplicatedInInput.startsWith("OFFICIAL::")
          ? "OFFICIAL_KEY"
          : "COMPOSITE",
      });
      continue;
    }
    dedupeKeys.forEach((key) => seen.add(key));
    normalized.push(normalizedItem);
  }

  const existing = await prisma.catalogItem.findMany({
    select: {
      officialKey: true,
      name: true,
      category: true,
      subcategory: true,
      brand: true,
      modelName: true,
      description: true,
    },
  });
  const existingKeys = new Set();
  existing.forEach((c) => {
    const officialKey = normalizeOfficialKey(c.officialKey) || extractOfficialKeyFromDescription(c.description);
    const dedupeKeys = buildDedupeKeys({ ...c, officialKey });
    dedupeKeys.forEach((key) => existingKeys.add(key));
  });

  const toCreate = [];
  for (const item of normalized) {
    const dedupeKeys = buildDedupeKeys(item);
    const existingMatch = dedupeKeys.find((key) => existingKeys.has(key));
    if (existingMatch) {
      skipped.push({
        ...item,
        reason: "ALREADY_EXISTS",
        dedupeBy: existingMatch.startsWith("OFFICIAL::")
          ? "OFFICIAL_KEY"
          : "COMPOSITE",
      });
      continue;
    }
    dedupeKeys.forEach((key) => existingKeys.add(key));
    toCreate.push(item);
  }

  const createManyData = toCreate.map((item) => ({
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    brand: item.brand,
    modelName: item.modelName,
    description: item.description,
    unit: item.unit,
    officialKey: item.officialKey,
  }));

  // Bulk insert avoids interactive transaction timeout on large files.
  const createManyResult = createManyData.length
    ? await prisma.catalogItem.createMany({
        data: createManyData,
        skipDuplicates: true,
      })
    : { count: 0 };

  const createdCount = Number(createManyResult?.count || 0);
  const raceSkipped = Math.max(0, toCreate.length - createdCount);
  if (raceSkipped > 0) {
    skipped.push({
      reason: "ALREADY_EXISTS",
      dedupeBy: "OFFICIAL_KEY_OR_COMPOSITE",
      count: raceSkipped,
    });
  }

  if (createdCount > 0) {
    await logAdminAudit({
      userId: user.id,
      entityType: "CATALOG_ITEM",
      action: "CREATE",
      entityId: 0,
      before: null,
      after: { bulk: true, createdCount, skippedCount: skipped.length },
    });
  }

  return {
    createdCount,
    skippedCount: skipped.length,
    skipped,
    items: [],
    dedupePolicy: DEDUPE_POLICY,
  };
}

async function buildCatalogItemsImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("CATALOGO_IMPORT");
  sheet.addRow([
    "officialKey",
    "name",
    "category",
    "subcategory",
    "brand",
    "modelName",
    "description",
    "unit",
  ]);
  sheet.addRow([
    "AF-001",
    "Notebook",
    "TIC",
    "Computacion",
    "Lenovo",
    "ThinkPad E14",
    "Equipo para uso administrativo",
    "unidad",
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 16 },
    { width: 30 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 24 },
    { width: 40 },
    { width: 12 },
  ];
  return workbook;
}

async function importCatalogItemsFromExcel(buffer, user, filename = "catalogo.xlsx") {
  requireCentral(user);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw badRequest(
      "Archivo Excel invalido o corrupto. Usa un .xlsx valido.",
      "CATALOG_IMPORT_INVALID_FILE"
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      filename,
      createdCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: [{ row: 1, error: "Archivo sin hojas" }],
      skipped: [],
      items: [],
      dedupePolicy: DEDUPE_POLICY,
    };
  }

  const headerRow = sheet.getRow(1);
  const headerMap = {};
  for (let c = 1; c <= headerRow.cellCount; c++) {
    const h = cleanCell(headerRow.getCell(c).value);
    if (!h) continue;
    headerMap[normalizeHeader(h)] = c;
  }

  const hasDirectName = headerMap[normalizeHeader("name")] !== undefined;
  const hasDirectCategory = headerMap[normalizeHeader("category")] !== undefined;
  const hasInventoryFormat = headerMap[normalizeHeader("CATEGORIA")] !== undefined;
  const hasAdvancedInventoryFormat =
    headerMap[normalizeHeader("CARACTERISTICAS")] !== undefined &&
    (
      headerMap[normalizeHeader("CODIGO_ACTIVO")] !== undefined ||
      headerMap[normalizeHeader("NUMERO_SERIE")] !== undefined ||
      headerMap[normalizeHeader("CENTRO_COSTO")] !== undefined
    );

  if (
    (!hasDirectName || !hasDirectCategory) &&
    !hasInventoryFormat &&
    !hasAdvancedInventoryFormat
  ) {
    return {
      filename,
      createdCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: [
        {
          row: 1,
          error:
            "Formato no reconocido. Usa name/category, INVENTARIO_PUBLICO (CATEGORIA, TIPO, MARCA, MODELO, OBSERVACIONES) o INVENTARIO AVANZADO (CARACTERISTICAS, ...; CODIGO_ACTIVO opcional).",
        },
      ],
      skipped: [],
      items: [],
      dedupePolicy: DEDUPE_POLICY,
    };
  }

  const mappedItems = [];
  const errors = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw = [];
    for (let c = 1; c <= headerRow.cellCount; c++) {
      raw.push(cleanCell(row.getCell(c).value));
    }
    if (!raw.some(Boolean)) continue;

    let item;
    if (hasDirectName && hasDirectCategory) {
      item = {
        name: pick(row, headerMap, ["name", "nombre"]),
        category: pick(row, headerMap, ["category", "categoria"]),
        subcategory: pick(row, headerMap, ["subcategory", "subcategoria"]),
        brand: pick(row, headerMap, ["brand", "marca"]),
        modelName: pick(row, headerMap, ["modelname", "modelo"]),
        description: pick(row, headerMap, ["description", "descripcion", "observaciones"]),
        unit: pick(row, headerMap, ["unit", "unidad"]),
        officialKey: pick(row, headerMap, ["officialkey", "codigo_activo", "codigoactivo", "codigo"]),
      };
    } else if (hasInventoryFormat) {
      const category = pick(row, headerMap, ["CATEGORIA"]);
      const type = pick(row, headerMap, ["TIPO"]);
      const brand = pick(row, headerMap, ["MARCA"]);
      const modelName = pick(row, headerMap, ["MODELO"]);
      const description = pick(row, headerMap, ["OBSERVACIONES"]);

      item = {
        name: type || [category, brand, modelName].filter(Boolean).join(" ").trim() || null,
        category,
        subcategory: type,
        brand,
        modelName,
        description,
        unit: "unidad",
        officialKey: null,
      };
    } else {
      const code = pick(row, headerMap, ["CODIGO_ACTIVO"]);
      const characteristics = pick(row, headerMap, ["CARACTERISTICAS"]);
      const serial = pick(row, headerMap, ["NUMERO_SERIE"]);
      const costCenter = pick(row, headerMap, ["CENTRO_COSTO"]);
      const acquisitionDate = pick(row, headerMap, ["FECHA_ADQUISICION"]);
      const lifeYears = pick(row, headerMap, ["VIDA_UTIL_ANIOS"]);
      const acquisitionValue = pick(row, headerMap, ["VALOR_ADQUISICION_CLP"]);
      const depreciation = pick(row, headerMap, ["DEPRECIACION_ANUAL_CLP"]);
      const bookValue = pick(row, headerMap, ["VALOR_LIBRO_ACTUAL_CLP"]);
      const state = pick(row, headerMap, ["ESTADO"]);
      const location = pick(row, headerMap, ["UBICACION"]);

      const tokens = String(characteristics || "")
        .split("/")
        .map((t) => t.trim())
        .filter(Boolean);

      const name = tokens[0] || code || null;
      const brand = tokens[1] || null;
      const modelName = tokens[2] || null;
      const extra = tokens.slice(3).join(" / ") || null;

      const detailParts = [
        code ? `Codigo: ${code}` : null,
        serial ? `Serie: ${serial}` : null,
        costCenter ? `Centro costo: ${costCenter}` : null,
        location ? `Ubicacion: ${location}` : null,
        state ? `Estado: ${state}` : null,
        acquisitionDate ? `Fecha adquisicion: ${acquisitionDate}` : null,
        lifeYears ? `Vida util: ${lifeYears}` : null,
        acquisitionValue ? `Valor adquisicion: ${acquisitionValue}` : null,
        depreciation ? `Depreciacion anual: ${depreciation}` : null,
        bookValue ? `Valor libro: ${bookValue}` : null,
        extra ? `Detalle: ${extra}` : null,
      ].filter(Boolean);

      item = {
        name,
        category: "INVENTARIO_AVANZADO",
        subcategory: costCenter || state || location || null,
        brand,
        modelName,
        description: detailParts.join(" | ") || null,
        unit: "unidad",
        officialKey: code,
      };
    }

    if (!item.name || !item.category) {
      errors.push({
        row: r,
        error: "Faltan datos requeridos (name/category)",
      });
      continue;
    }

    mappedItems.push(item);
  }

  const bulk = await createCatalogItemsBulk({ items: mappedItems }, user);
  return {
    filename,
    totalRows: Math.max(sheet.rowCount - 1, 0),
    parsedCount: mappedItems.length,
    createdCount: bulk.createdCount,
    skippedCount: bulk.skippedCount,
    errorCount: errors.length,
    errors,
    skipped: bulk.skipped,
    items: bulk.items,
    dedupePolicy: bulk.dedupePolicy,
  };
}

module.exports = {
  listCatalogItems,
  getCatalogItem,
  checkOfficialKeyAvailability,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogItemForceDeleteSummary,
  deleteCatalogItemPermanentForce,
  purgeCatalogAndResetSequence,
  createCatalogItemsBulk,
  buildCatalogItemsImportTemplate,
  importCatalogItemsFromExcel,
};
