const { prisma } = require("../prisma");
const { notFound, conflict, forbidden, badRequest } = require("../utils/httpError");
const {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildAssetForceDeleteSummary,
} = require("./adminForceDeleteService");

const ASSET_FORCE_DELETE_CODES = {
  REQUIRES_DELETED: "ASSET_HARD_DELETE_REQUIRES_DELETED",
};

function requireCentral(user) {
  if (user?.role?.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede eliminar activos definitivamente");
  }
}

async function getAssetForceDeleteSummary(assetId, user) {
  requireCentral(user);
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, name: true, isDeleted: true, internalCode: true },
  });
  if (!asset) throw notFound("Asset no encontrado");
  if (!asset.isDeleted) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja el activo",
      ASSET_FORCE_DELETE_CODES.REQUIRES_DELETED
    );
  }
  const summary = await buildAssetForceDeleteSummary(prisma, assetId);
  return {
    entityType: "ASSET",
    entityId: asset.id,
    entityName: `${asset.name} (INV-${asset.internalCode})`,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    summary,
  };
}

async function deleteAssetPermanentForce(assetId, data, user) {
  requireCentral(user);
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, name: true, isDeleted: true, internalCode: true },
  });
  if (!asset) throw notFound("Asset no encontrado");
  if (!asset.isDeleted) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja el activo",
      ASSET_FORCE_DELETE_CODES.REQUIRES_DELETED
    );
  }
  if (String(data?.confirmationText || "").trim() !== FORCE_DELETE_CONFIRMATION_TEXT) {
    throw badRequest(
      `Debes confirmar con el texto exacto: ${FORCE_DELETE_CONFIRMATION_TEXT}`,
      "FORCE_DELETE_CONFIRMATION_INVALID"
    );
  }

  const summary = await buildAssetForceDeleteSummary(prisma, assetId);
  await prisma.$transaction(async (tx) => {
    const movementRows = await tx.movement.findMany({
      where: { assetId },
      select: { id: true },
    });
    const movementIds = movementRows.map((row) => row.id);

    if (movementIds.length) {
      await tx.assetEvidence.deleteMany({
        where: {
          OR: [{ movementId: { in: movementIds } }, { assetId }],
        },
      });
    } else {
      await tx.assetEvidence.deleteMany({ where: { assetId } });
    }
    await tx.assetAudit.deleteMany({ where: { assetId } });
    await tx.movement.deleteMany({ where: { assetId } });
    await tx.asset.delete({ where: { id: assetId } });
  });

  return {
    id: asset.id,
    hardDeleted: true,
    forced: true,
    summary,
  };
}

module.exports = {
  ASSET_FORCE_DELETE_CODES,
  getAssetForceDeleteSummary,
  deleteAssetPermanentForce,
};

