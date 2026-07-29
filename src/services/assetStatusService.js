const { prisma } = require("../prisma");
const { canChangeAssetStatus, enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { snapshotAsset } = require("./assetAuditService");
const { sendAccountingBajaEmail } = require("./mailerService");
const { notFound, forbidden, conflict } = require("../utils/httpError");
const { requireReasonCode } = require("../utils/movementReasonValidation");
const { parseRequiredMovementEvidence } = require("../utils/movementEvidenceValidation");

const ASSET_STATUS_CONFLICT_CODES = {
  SAME_STATE: "ASSET_STATUS_SAME_STATE",
  ALREADY_DELETED: "ASSET_STATUS_ALREADY_DELETED",
  DELETED_REQUIRES_RESTORE: "ASSET_STATUS_DELETED_REQUIRES_RESTORE",
};

async function changeAssetStatus(
  assetId,
  assetStateId,
  reasonCode,
  evidencePayload,
  evidenceFile,
  user
) {
  const normalizedReasonCode = requireReasonCode("STATUS_CHANGE", reasonCode);

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      dependency: { select: { id: true, name: true } },
      establishment: { select: { id: true, name: true } },
    },
  });

  if (!asset) throw notFound("Asset no encontrado");

  enforceEstablishmentScope(user, asset.establishmentId);
  if (!canChangeAssetStatus(user, asset)) {
    throw forbidden("No autorizado para cambiar estado de este asset");
  }

  if (asset.assetStateId === assetStateId) {
    throw conflict("El asset ya tiene ese estado", ASSET_STATUS_CONFLICT_CODES.SAME_STATE);
  }

  const state = await prisma.assetState.findUnique({
    where: { id: assetStateId },
  });
  if (!state) throw notFound("AssetState no existe");
  if (asset.isDeleted && state.name === "BAJA") {
    throw conflict("El asset ya esta dado de baja", ASSET_STATUS_CONFLICT_CODES.ALREADY_DELETED);
  }
  if (asset.isDeleted && state.name !== "BAJA") {
    throw conflict(
      "El asset esta dado de baja. Debes restaurarlo primero",
      ASSET_STATUS_CONFLICT_CODES.DELETED_REQUIRES_RESTORE
    );
  }
  const evidenceInput =
    state.name === "BAJA"
      ? parseRequiredMovementEvidence(evidencePayload, evidenceFile)
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    const before = snapshotAsset(asset);
    const moved = await tx.asset.update({
      where: { id: assetId },
      data: {
        assetStateId,
        ...(state.name === "BAJA"
          ? {
              isDeleted: true,
              deletedAt: new Date(),
              deletedById: user.id,
            }
          : {}),
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
    if (evidenceInput) {
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
    }

    await tx.assetAudit.create({
      data: {
        action: "STATUS_CHANGE",
        assetId: assetId,
        userId: user.id,
        before,
        after: {
          ...snapshotAsset(moved),
          _meta: { reasonCode: normalizedReasonCode },
        },
      },
    });

    return { moved, movementId: movement.id };
  });

  if (state.name === "BAJA") {
    void sendAccountingBajaEmail({
      asset,
      movementId: updated.movementId,
      reasonCode: normalizedReasonCode,
      actor: user,
    })
      .then((result) => {
        if (result?.status === "sent") {
          console.log("[asset-status] aviso contable de baja enviado", {
            assetId,
            movementId: updated.movementId,
            messageId: result.messageId || null,
          });
        }
      })
      .catch((error) => {
        console.error("[asset-status] fallo aviso contable de baja", {
          assetId,
          movementId: updated.movementId,
          error: error?.message || error,
        });
      });
  }

  return {
    ...updated.moved,
    movementId: updated.movementId,
  };
}

module.exports = { changeAssetStatus };
