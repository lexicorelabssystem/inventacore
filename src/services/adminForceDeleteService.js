const { prisma } = require("../prisma");

const FORCE_DELETE_CONFIRMATION_TEXT = "ELIMINAR DEFINITIVO";

function uniqueIds(values) {
  return [...new Set((values || []).filter((x) => Number.isInteger(x) && x > 0))];
}

async function selectIds(db, model, where) {
  const rows = await db[model].findMany({ where, select: { id: true } });
  return uniqueIds(rows.map((row) => Number(row.id)));
}

async function selectMovementIds(db, { assetIds = [], dependencyIds = [], userIds = [] }) {
  const or = [];
  if (assetIds.length) or.push({ assetId: { in: assetIds } });
  if (dependencyIds.length) {
    or.push({ fromDependencyId: { in: dependencyIds } });
    or.push({ toDependencyId: { in: dependencyIds } });
  }
  if (userIds.length) or.push({ userId: { in: userIds } });
  if (!or.length) return [];
  return selectIds(db, "movement", { OR: or });
}

async function selectSupportRequestIds(db, { institutionIds = [], establishmentIds = [], dependencyIds = [], userIds = [] }) {
  const or = [];
  if (institutionIds.length) or.push({ institutionId: { in: institutionIds } });
  if (establishmentIds.length) or.push({ establishmentId: { in: establishmentIds } });
  if (dependencyIds.length) or.push({ dependencyId: { in: dependencyIds } });
  if (userIds.length) {
    or.push({ createdById: { in: userIds } });
    or.push({ assignedToId: { in: userIds } });
  }
  if (!or.length) return [];
  return selectIds(db, "supportRequest", { OR: or });
}

async function summarizeUserLinked(db, userIds) {
  if (!userIds.length) {
    return {
      refreshTokens: 0,
      loginAudits: 0,
      adminAudits: 0,
      assetImportBatches: 0,
      userPhotos: 0,
      supportRequestCommentsByUser: 0,
    };
  }
  const [
    refreshTokens,
    loginAudits,
    adminAudits,
    assetImportBatches,
    userPhotos,
    supportRequestCommentsByUser,
  ] = await Promise.all([
    db.refreshToken.count({ where: { userId: { in: userIds } } }),
    db.loginAudit.count({ where: { userId: { in: userIds } } }),
    db.adminAudit.count({ where: { userId: { in: userIds } } }),
    db.assetImportBatch.count({ where: { userId: { in: userIds } } }),
    db.userPhoto.count({ where: { userId: { in: userIds } } }),
    db.supportRequestComment.count({ where: { authorId: { in: userIds } } }),
  ]);

  return {
    refreshTokens,
    loginAudits,
    adminAudits,
    assetImportBatches,
    userPhotos,
    supportRequestCommentsByUser,
  };
}

async function summarizeAssetLinked(db, { assetIds = [], movementIds = [] }) {
  if (!assetIds.length && !movementIds.length) {
    return {
      assetEvidencesByAsset: 0,
      assetEvidencesByMovement: 0,
      assetAudits: 0,
      movements: movementIds.length,
    };
  }
  const whereAsset = assetIds.length ? { assetId: { in: assetIds } } : null;
  const whereMovement = movementIds.length ? { movementId: { in: movementIds } } : null;
  const [assetEvidencesByAsset, assetEvidencesByMovement, assetAudits] = await Promise.all([
    whereAsset ? db.assetEvidence.count({ where: whereAsset }) : 0,
    whereMovement ? db.assetEvidence.count({ where: whereMovement }) : 0,
    whereAsset ? db.assetAudit.count({ where: whereAsset }) : 0,
  ]);
  return {
    assetEvidencesByAsset,
    assetEvidencesByMovement,
    assetAudits,
    movements: movementIds.length,
  };
}

async function buildDependencyForceDeletePlan(db, dependencyId) {
  const dependencyIds = [dependencyId];
  const assetIds = await selectIds(db, "asset", { dependencyId });
  const movementIds = await selectMovementIds(db, { assetIds, dependencyIds });
  const supportRequestIds = await selectSupportRequestIds(db, { dependencyIds });
  const [assetSummary, supportRequestComments] = await Promise.all([
    summarizeAssetLinked(db, { assetIds, movementIds }),
    supportRequestIds.length
      ? db.supportRequestComment.count({ where: { requestId: { in: supportRequestIds } } })
      : 0,
  ]);

  return {
    dependencyIds,
    assetIds,
    movementIds,
    supportRequestIds,
    userIds: [],
    establishmentIds: [],
    institutionIds: [],
    assetSequenceIds: [],
    summary: {
      dependencies: dependencyIds.length,
      assets: assetIds.length,
      movements: movementIds.length,
      supportRequests: supportRequestIds.length,
      supportRequestComments,
      ...assetSummary,
      confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    },
  };
}

async function buildUserForceDeletePlan(db, userId) {
  const userIds = [userId];
  const movementIds = await selectMovementIds(db, { userIds });
  const supportRequestIds = await selectSupportRequestIds(db, { userIds });
  const [userSummary, supportRequestComments, assetEvidencesByMovement] = await Promise.all([
    summarizeUserLinked(db, userIds),
    supportRequestIds.length
      ? db.supportRequestComment.count({ where: { requestId: { in: supportRequestIds } } })
      : 0,
    movementIds.length ? db.assetEvidence.count({ where: { movementId: { in: movementIds } } }) : 0,
  ]);

  return {
    dependencyIds: [],
    assetIds: [],
    movementIds,
    supportRequestIds,
    userIds,
    establishmentIds: [],
    institutionIds: [],
    assetSequenceIds: [],
    summary: {
      users: 1,
      movements: movementIds.length,
      supportRequests: supportRequestIds.length,
      supportRequestComments,
      assetEvidencesByMovement,
      ...userSummary,
      confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    },
  };
}

async function buildCatalogItemForceDeleteSummary(db, catalogItemId) {
  const linkedAssets = await db.asset.count({ where: { catalogItemId } });
  return {
    catalogItems: 1,
    linkedAssets,
    effects: linkedAssets > 0 ? "SET_ASSET_CATALOG_NULL" : "NONE",
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
  };
}

async function buildAssetForceDeleteSummary(db, assetId) {
  const movementIds = await selectIds(db, "movement", { assetId });
  const [assetAudits, evidencesByAsset, evidencesByMovement] = await Promise.all([
    db.assetAudit.count({ where: { assetId } }),
    db.assetEvidence.count({ where: { assetId } }),
    movementIds.length ? db.assetEvidence.count({ where: { movementId: { in: movementIds } } }) : 0,
  ]);
  return {
    assets: 1,
    movements: movementIds.length,
    assetAudits,
    assetEvidencesByAsset: evidencesByAsset,
    assetEvidencesByMovement: evidencesByMovement,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
  };
}

async function buildEstablishmentForceDeletePlan(db, establishmentId) {
  const establishmentIds = [establishmentId];
  const dependencyIds = await selectIds(db, "dependency", { establishmentId });
  const assetIds = await selectIds(db, "asset", { establishmentId });
  const userIds = await selectIds(db, "user", { establishmentId });
  const [movementIds, supportRequestIds, userSummary] = await Promise.all([
    selectMovementIds(db, { assetIds, dependencyIds, userIds }),
    selectSupportRequestIds(db, { establishmentIds, dependencyIds, userIds }),
    summarizeUserLinked(db, userIds),
  ]);
  const [assetSummary, supportRequestComments] = await Promise.all([
    summarizeAssetLinked(db, { assetIds, movementIds }),
    supportRequestIds.length
      ? db.supportRequestComment.count({ where: { requestId: { in: supportRequestIds } } })
      : 0,
  ]);
  const [dependencyRows, assetsByDependency, supportByDependency] = await Promise.all([
    db.dependency.findMany({
      where: { establishmentId },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    dependencyIds.length
      ? db.asset.groupBy({
          by: ["dependencyId"],
          where: { dependencyId: { in: dependencyIds } },
          _count: { _all: true },
        })
      : [],
    dependencyIds.length
      ? db.supportRequest.groupBy({
          by: ["dependencyId"],
          where: { dependencyId: { in: dependencyIds } },
          _count: { _all: true },
        })
      : [],
  ]);
  const assetsByDepMap = new Map(
    assetsByDependency.map((row) => [Number(row.dependencyId), Number(row._count?._all || 0)])
  );
  const supportByDepMap = new Map(
    supportByDependency
      .filter((row) => Number.isInteger(Number(row.dependencyId)))
      .map((row) => [Number(row.dependencyId), Number(row._count?._all || 0)])
  );
  const dependencyDetails = dependencyRows.map((dep) => ({
    id: dep.id,
    name: dep.name,
    isActive: dep.isActive,
    assets: assetsByDepMap.get(Number(dep.id)) || 0,
    supportRequests: supportByDepMap.get(Number(dep.id)) || 0,
  }));

  return {
    dependencyIds,
    assetIds,
    movementIds,
    supportRequestIds,
    userIds,
    establishmentIds,
    institutionIds: [],
    assetSequenceIds: [],
    summary: {
      establishments: establishmentIds.length,
      dependencies: dependencyIds.length,
      assets: assetIds.length,
      users: userIds.length,
      movements: movementIds.length,
      supportRequests: supportRequestIds.length,
      supportRequestComments,
      ...assetSummary,
      ...userSummary,
      confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    },
    details: {
      dependencies: dependencyDetails,
      branches: {
        users: userIds.length,
        assets: assetIds.length,
        movements: movementIds.length,
        supportRequests: supportRequestIds.length,
      },
    },
  };
}

async function buildInstitutionForceDeletePlan(db, institutionId) {
  const institutionIds = [institutionId];
  const establishmentIds = await selectIds(db, "establishment", { institutionId });
  const dependencyIds = establishmentIds.length
    ? await selectIds(db, "dependency", { establishmentId: { in: establishmentIds } })
    : [];
  const assetIds = establishmentIds.length
    ? await selectIds(db, "asset", { establishmentId: { in: establishmentIds } })
    : [];
  const userIds = await selectIds(db, "user", { institutionId });
  const assetSequenceIds = await selectIds(db, "assetSequence", { institutionId });
  const [movementIds, supportRequestIds, userSummary] = await Promise.all([
    selectMovementIds(db, { assetIds, dependencyIds, userIds }),
    selectSupportRequestIds(db, { institutionIds, establishmentIds, dependencyIds, userIds }),
    summarizeUserLinked(db, userIds),
  ]);
  const [assetSummary, supportRequestComments] = await Promise.all([
    summarizeAssetLinked(db, { assetIds, movementIds }),
    supportRequestIds.length
      ? db.supportRequestComment.count({ where: { requestId: { in: supportRequestIds } } })
      : 0,
  ]);

  return {
    dependencyIds,
    assetIds,
    movementIds,
    supportRequestIds,
    userIds,
    establishmentIds,
    institutionIds,
    assetSequenceIds,
    summary: {
      institutions: institutionIds.length,
      establishments: establishmentIds.length,
      dependencies: dependencyIds.length,
      assets: assetIds.length,
      users: userIds.length,
      movements: movementIds.length,
      assetSequences: assetSequenceIds.length,
      supportRequests: supportRequestIds.length,
      supportRequestComments,
      ...assetSummary,
      ...userSummary,
      confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    },
  };
}

async function purgeByForceDeletePlan(tx, plan) {
  const {
    dependencyIds = [],
    assetIds = [],
    movementIds = [],
    supportRequestIds = [],
    userIds = [],
    establishmentIds = [],
    institutionIds = [],
    assetSequenceIds = [],
  } = plan;

  const evidenceOr = [];
  if (assetIds.length) evidenceOr.push({ assetId: { in: assetIds } });
  if (movementIds.length) evidenceOr.push({ movementId: { in: movementIds } });
  if (userIds.length) evidenceOr.push({ uploadedById: { in: userIds } });
  if (evidenceOr.length) {
    await tx.assetEvidence.deleteMany({ where: { OR: evidenceOr } });
  }

  const assetAuditOr = [];
  if (assetIds.length) assetAuditOr.push({ assetId: { in: assetIds } });
  if (userIds.length) assetAuditOr.push({ userId: { in: userIds } });
  if (assetAuditOr.length) {
    await tx.assetAudit.deleteMany({ where: { OR: assetAuditOr } });
  }

  const supportCommentOr = [];
  if (supportRequestIds.length) supportCommentOr.push({ requestId: { in: supportRequestIds } });
  if (userIds.length) supportCommentOr.push({ authorId: { in: userIds } });
  if (supportCommentOr.length) {
    await tx.supportRequestComment.deleteMany({ where: { OR: supportCommentOr } });
  }

  if (supportRequestIds.length) {
    await tx.supportRequest.deleteMany({ where: { id: { in: supportRequestIds } } });
  }

  if (movementIds.length) {
    await tx.movement.deleteMany({ where: { id: { in: movementIds } } });
  }

  if (userIds.length) {
    await tx.asset.updateMany({
      where: { deletedById: { in: userIds } },
      data: { deletedById: null },
    });
    await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.loginAudit.deleteMany({ where: { userId: { in: userIds } } });
    await tx.adminAudit.deleteMany({ where: { userId: { in: userIds } } });
    await tx.assetImportBatch.deleteMany({ where: { userId: { in: userIds } } });
    await tx.userPhoto.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  }

  if (assetIds.length) {
    await tx.asset.deleteMany({ where: { id: { in: assetIds } } });
  }
  if (dependencyIds.length) {
    await tx.dependency.deleteMany({ where: { id: { in: dependencyIds } } });
  }
  if (assetSequenceIds.length) {
    await tx.assetSequence.deleteMany({ where: { id: { in: assetSequenceIds } } });
  }
  if (establishmentIds.length) {
    await tx.establishment.deleteMany({ where: { id: { in: establishmentIds } } });
  }
  if (institutionIds.length) {
    await tx.institution.deleteMany({ where: { id: { in: institutionIds } } });
  }
}

module.exports = {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildDependencyForceDeletePlan,
  buildEstablishmentForceDeletePlan,
  buildInstitutionForceDeletePlan,
  buildUserForceDeletePlan,
  buildCatalogItemForceDeleteSummary,
  buildAssetForceDeleteSummary,
  purgeByForceDeletePlan,
};
