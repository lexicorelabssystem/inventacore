// src/services/assetQueryService.js
const { prisma } = require("../prisma");
const { badRequest } = require("../utils/httpError");
const { env } = require("../config/env");
const { buildScopedAssetWhere } = require("../utils/assetScopeWhere");
const { withSequentialVisibleCode } = require("../utils/assetCode");

function toInt(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}


async function listAssets(query, user) {
  if (env.NODE_ENV !== "production") {
    console.log("[assets] listAssets start", {
      q: query.q,
      institutionId: query.institutionId,
      establishmentId: query.establishmentId,
      dependencyId: query.dependencyId,
      assetStateId: query.assetStateId,
      assetType: query.assetType,
      take: query.take,
      skip: query.skip,
      withCount: query.withCount,
    });
  }
  const q = (query.q || "").trim();
  const id = toInt(query.id);
  const institutionId = toInt(query.institutionId);
  const establishmentId = toInt(query.establishmentId);
  const dependencyId = toInt(query.dependencyId);
  const assetStateId = toInt(query.assetStateId);
  const includeDeleted =
    query.includeDeleted === true ||
    query.includeDeleted === "true" ||
    query.includeDeleted === "1";
  const onlyDeleted =
    query.onlyDeleted === true ||
    query.onlyDeleted === "true" ||
    query.onlyDeleted === "1";
  const deletedFrom = query.deletedFrom ? new Date(query.deletedFrom) : undefined;
  const deletedTo = query.deletedTo ? new Date(query.deletedTo) : undefined;
  const assetType = (query.assetType || "").trim(); // "FIXED" | "CONTROL"
  const brand = (query.brand || "").trim();
  const modelName = (query.modelName || "").trim();
  const serialNumber = (query.serialNumber || "").trim();
  const responsibleName = (query.responsibleName || "").trim();
  const costCenter = (query.costCenter || "").trim();
  const internalCode = toInt(query.internalCode);
  const minValue = query.minValue !== undefined ? Number(query.minValue) : undefined;
  const maxValue = query.maxValue !== undefined ? Number(query.maxValue) : undefined;
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
  const toDate = query.toDate ? new Date(query.toDate) : undefined;
  const sortBy = (query.sortBy || "id").trim();
  const sortOrder = (query.sortOrder || "desc").trim();
  const withCount =
    query.withCount === true ||
    query.withCount === "true" ||
    query.withCount === "1"
      ? true
      : false;

  const take = Math.min(Math.max(toInt(query.take) || 20, 1), 100);
  const skip = Math.max(toInt(query.skip) || 0, 0);

  // Permisos por rol (modo simple)
  // ADMIN_CENTRAL: puede filtrar libre
  // ADMIN_ESTABLISHMENT: SIEMPRE forzamos establishmentId del usuario
  // VIEWER: solo lectura (lo aplicamos en rutas, aqui solo filtramos igual que su rol)
  let effectiveEstablishmentId = establishmentId;

  if (user?.role?.type === "ADMIN_ESTABLISHMENT") {
    if (!user.establishmentId) throw badRequest("ADMIN_ESTABLISHMENT sin establishmentId");
    effectiveEstablishmentId = user.establishmentId;
  }

  const deletedBaseFilter = onlyDeleted ? true : includeDeleted ? undefined : false;
  const where = {
    ...(id ? { id } : {}),
    ...buildScopedAssetWhere({
      establishmentId: effectiveEstablishmentId,
      dependencyId,
      fromDate,
      toDate,
      isDeleted: deletedBaseFilter,
    }),
    ...(assetStateId ? { assetStateId } : {}),
  };

  // Filtrar por institucion (via relacion establishment -> institutionId)
  // Si ya forzamos establishmentId, este filtro es redundante, pero no molesta.
  if (institutionId) {
    where.establishment = { institutionId };
  }

  // Filtrar por tipo (FIXED/CONTROL) usando relacion AssetType.name
  if (assetType) {
    where.assetType = { name: assetType };
  }

  if (deletedFrom || deletedTo) {
    where.deletedAt = {
      ...(deletedFrom ? { gte: deletedFrom } : {}),
      ...(deletedTo ? { lte: deletedTo } : {}),
    };
  }

  if (brand) {
    where.brand = { contains: brand, mode: "insensitive" };
  }

  if (modelName) {
    where.modelName = { contains: modelName, mode: "insensitive" };
  }

  if (serialNumber) {
    where.serialNumber = { contains: serialNumber, mode: "insensitive" };
  }
  if (responsibleName) {
    where.responsibleName = { contains: responsibleName, mode: "insensitive" };
  }
  if (costCenter) {
    where.costCenter = { contains: costCenter, mode: "insensitive" };
  }

  if (internalCode) {
    where.internalCode = internalCode;
  }

  if (minValue !== undefined || maxValue !== undefined) {
    where.acquisitionValue = {
      ...(minValue !== undefined ? { gte: minValue } : {}),
      ...(maxValue !== undefined ? { lte: maxValue } : {}),
    };
  }

  // Busqueda tipo "Google"
  if (q) {
    const maybeCode = Number(q);
    where.OR = [
      ...(Number.isFinite(maybeCode) ? [{ internalCode: maybeCode }] : []),
      { name: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { modelName: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { responsibleName: { contains: q, mode: "insensitive" } },
      { costCenter: { contains: q, mode: "insensitive" } },
    ];
  }

  // IMPORTANTE: no Promise.all (connection_limit=1)
  const orderBy = { [sortBy]: sortOrder };

  const items = await prisma.asset.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      assetType: true,
      assetState: true,
      establishment: true,
      dependency: true,
      catalogItem: true,
    },
  });
  if (env.NODE_ENV !== "production") {
    console.log("[assets] findMany done", { count: items.length });
  }

  const total = withCount ? await prisma.asset.count({ where }) : null;
  if (withCount) {
    if (env.NODE_ENV !== "production") {
      console.log("[assets] count done", { total });
    }
  }

  return { total, skip, take, items };
}

async function listAllAssetsForExport(query, user) {
  const pageSize = 100;
  const maxRows = 20000;
  const items = [];

  for (let skip = 0; skip < maxRows; skip += pageSize) {
    const page = await listAssets(
      {
        ...query,
        take: pageSize,
        skip,
        withCount: false,
        sortBy: query.sortBy || "internalCode",
        sortOrder: query.sortOrder || "asc",
      },
      user
    );
    items.push(...page.items);
    if (page.items.length < pageSize) break;
  }

  const itemsWithVisibleCode = withSequentialVisibleCode(items);
  return {
    total: itemsWithVisibleCode.length,
    skip: 0,
    take: itemsWithVisibleCode.length,
    items: itemsWithVisibleCode,
  };
}

module.exports = { listAssets, listAllAssetsForExport };
