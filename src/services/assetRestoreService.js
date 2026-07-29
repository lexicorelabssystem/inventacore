const { prisma } = require("../prisma");
const { canChangeAssetStatus, enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { snapshotAsset } = require("./assetAuditService");
const { notFound, forbidden, conflict, badRequest } = require("../utils/httpError");
const { requireReasonCode } = require("../utils/movementReasonValidation");
const { parseRequiredMovementEvidence } = require("../utils/movementEvidenceValidation");

const ASSET_RESTORE_CONFLICT_CODES = {
  NOT_DELETED: "ASSET_RESTORE_NOT_DELETED",
};

async function restoreAsset(assetId, assetStateId, reasonCode, evidencePayload, evidenceFile, user) {
  const normalizedReasonCode = requireReasonCode("RESTORE", reasonCode);
  const evidenceInput = parseRequiredMovementEvidence(evidencePayload, evidenceFile);

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound("Asset no encontrado");

  enforceEstablishmentScope(user, asset.establishmentId);
  if (!canChangeAssetStatus(user, asset)) {
    throw forbidden("No autorizado para restaurar este asset");
  }

  if (!asset.isDeleted) {
    throw conflict("El asset no esta dado de baja", ASSET_RESTORE_CONFLICT_CODES.NOT_DELETED);
  }

  let targetState = null;
  if (assetStateId) {
    targetState = await prisma.assetState.findUnique({ where: { id: assetStateId } });
    if (!targetState) throw notFound("AssetState no existe");
    if (targetState.name === "BAJA") {
      throw badRequest("No se puede restaurar a estado BAJA");
    }
  } else {
    targetState = await prisma.assetState.findFirst({ where: { name: "BUENO" } });
    if (!targetState) throw notFound("AssetState BUENO no existe");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = snapshotAsset(asset);
    const restored = await tx.asset.update({
      where: { id: assetId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        assetStateId: targetState.id,
      },
    });

    const movement = await tx.movement.create({
      data: {
        type: "STATUS_CHANGE",
        reasonCode: normalizedReasonCode,
        reason: normalizedReasonCode,
        assetId: assetId,
        fromDependencyId: asset.dependencyId,
        toDependencyId: asset.dependencyId,
        userId: user.id,
      },
    });
    await tx.assetEvidence.create({
      data: {
        assetId: assetId,
        movementId: movement.id,
        uploadedById: user.id,
        docType: evidenceInput.docType,
        note: evidenceInput.note,
        fileName: evidenceInput.fileName,
        mimeType: evidenceInput.mimeType,
        sizeBytes: evidenceInput.sizeBytes,
        content: evidenceInput.content,
      },
    });

    await tx.assetAudit.create({
      data: {
        action: "RESTORE",
        assetId: assetId,
        userId: user.id,
        before,
        after: {
          ...snapshotAsset(restored),
          _meta: { reasonCode: normalizedReasonCode },
        },
      },
    });

    return { restored, movementId: movement.id };
  });

  return {
    ...updated.restored,
    movementId: updated.movementId,
  };
}

module.exports = { restoreAsset };
