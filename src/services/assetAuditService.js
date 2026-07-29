const { prisma } = require("../prisma");
const { badRequest } = require("../utils/httpError");

function snapshotAsset(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    internalCode: asset.internalCode,
    name: asset.name,
    quantity: asset.quantity,
    brand: asset.brand,
    modelName: asset.modelName,
    serialNumber: asset.serialNumber,
    accountingAccount: asset.accountingAccount,
    analyticCode: asset.analyticCode,
    responsibleName: asset.responsibleName,
    responsibleRut: asset.responsibleRut,
    responsibleRole: asset.responsibleRole,
    costCenter: asset.costCenter,
    acquisitionValue: asset.acquisitionValue,
    acquisitionDate: asset.acquisitionDate,
    depreciationStartDate: asset.depreciationStartDate,
    usefulLifeYears: asset.usefulLifeYears,
    depreciationAnnualValue: asset.depreciationAnnualValue,
    assetTypeId: asset.assetTypeId,
    assetStateId: asset.assetStateId,
    establishmentId: asset.establishmentId,
    dependencyId: asset.dependencyId,
  };
}

async function logAssetAudit({ userId, action, assetId, before, after }) {
  return prisma.assetAudit.create({
    data: {
      userId,
      action,
      assetId,
      before: before || null,
      after: after || null,
    },
  });
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

async function listAssetAudits(query, user) {
  const take = clampTake(Number(query.take));
  const skip = clampSkip(Number(query.skip));
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  if (user.role.type === "ADMIN_ESTABLISHMENT" && !user.establishmentId) {
    throw badRequest("ADMIN_ESTABLISHMENT sin establishmentId");
  }

  const assetId = parsePositiveInt(query.assetId);
  const userId = parsePositiveInt(query.userId);

  const where = {
    ...(assetId ? { assetId } : {}),
    ...(userId ? { userId } : {}),
    ...(query.action ? { action: query.action } : {}),
  };

  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    where.asset = { establishmentId: user.establishmentId };
  }

  if (query.fromDate || query.toDate) {
    where.createdAt = {
      ...(query.fromDate ? { gte: query.fromDate } : {}),
      ...(query.toDate ? { lte: query.toDate } : {}),
    };
  }

  if (query.q) {
    const q = query.q.trim();
    const qNum = Number(q);
    const or = [
      { asset: { name: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];

    if (Number.isFinite(qNum)) {
      or.push({ assetId: qNum });
      or.push({ asset: { internalCode: qNum } });
    }

    where.OR = or;
  }

  const items = await prisma.assetAudit.findMany({
    where,
    orderBy: { createdAt: sortOrder },
    take,
    skip,
    include: {
      user: { select: { id: true, name: true, email: true } },
      asset: {
        select: {
          id: true,
          internalCode: true,
          name: true,
          establishmentId: true,
          dependencyId: true,
        },
      },
    },
  });

  const total = await prisma.assetAudit.count({ where });
  return { total, skip, take, items };
}

module.exports = { logAssetAudit, snapshotAsset, listAssetAudits };
