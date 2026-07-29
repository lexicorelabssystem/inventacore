const { prisma } = require("../prisma");
const { canTransferAsset } = require("../permissions/assetPermissions");
const { notFound, forbidden, badRequest, conflict } = require("../utils/httpError");
const { snapshotAsset } = require("./assetAuditService");
const { requireReasonCode } = require("../utils/movementReasonValidation");
const { parseRequiredMovementEvidence } = require("../utils/movementEvidenceValidation");

const ASSET_TRANSFER_CONFLICT_CODES = {
  ASSET_DELETED: "ASSET_TRANSFER_ASSET_DELETED",
  SAME_DESTINATION: "ASSET_TRANSFER_SAME_DESTINATION",
};

async function transferAsset(
  assetId,
  toEstablishmentId,
  toDependencyId,
  reasonCode,
  evidencePayload,
  evidenceFile,
  user
) {
  const normalizedReasonCode = requireReasonCode("TRANSFER", reasonCode);
  const evidenceInput = parseRequiredMovementEvidence(evidencePayload, evidenceFile);

  if (!canTransferAsset(user)) {
    throw forbidden("Solo ADMIN_CENTRAL puede transferir assets");
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      internalCode: true,
      name: true,
      brand: true,
      modelName: true,
      serialNumber: true,
      accountingAccount: true,
      analyticCode: true,
      acquisitionValue: true,
      acquisitionDate: true,
      assetTypeId: true,
      assetStateId: true,
      isDeleted: true,
      establishmentId: true,
      dependencyId: true,
      establishment: { select: { institutionId: true } },
    },
  });

  if (!asset) throw notFound("Asset no encontrado");
  if (asset.isDeleted) {
    throw conflict("El asset esta dado de baja", ASSET_TRANSFER_CONFLICT_CODES.ASSET_DELETED);
  }

  if (
    asset.establishmentId === toEstablishmentId &&
    asset.dependencyId === toDependencyId
  ) {
    throw conflict(
      "El asset ya esta en ese establecimiento y sector",
      ASSET_TRANSFER_CONFLICT_CODES.SAME_DESTINATION
    );
  }

  const toEstablishment = await prisma.establishment.findUnique({
    where: { id: toEstablishmentId },
    select: { id: true, institutionId: true, isActive: true },
  });
  if (!toEstablishment) throw notFound("Establishment destino no existe");
  if (!toEstablishment.isActive) throw badRequest("Establishment destino inactivo");

  if (toEstablishment.institutionId !== asset.establishment.institutionId) {
    throw badRequest("No se puede transferir a otra institucion");
  }

  const toDependency = await prisma.dependency.findUnique({
    where: { id: toDependencyId },
    select: { id: true, establishmentId: true, isActive: true },
  });
  if (!toDependency) throw notFound("Sector destino no existe");
  if (!toDependency.isActive) throw badRequest("Sector destino inactivo");

  if (toDependency.establishmentId !== toEstablishmentId) {
    throw badRequest("Sector no pertenece al establishment destino");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = snapshotAsset(asset);
    const moved = await tx.asset.update({
      where: { id: assetId },
      data: {
        establishmentId: toEstablishmentId,
        dependencyId: toDependencyId,
      },
    });

    const movement = await tx.movement.create({
      data: {
        type: "TRANSFER",
        reasonCode: normalizedReasonCode,
        reason: normalizedReasonCode,
        assetId: assetId,
        fromDependencyId: asset.dependencyId,
        toDependencyId: toDependencyId,
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
        action: "RELOCATE",
        assetId: assetId,
        userId: user.id,
        before,
        after: {
          ...snapshotAsset(moved),
          _meta: { reasonCode: normalizedReasonCode, kind: "TRANSFER" },
        },
      },
    });

    return { moved, movementId: movement.id };
  });

  return {
    ...(
      (await prisma.asset.findUnique({
        where: { id: updated.moved.id },
        include: {
          assetType: true,
          assetState: true,
          establishment: true,
          dependency: true,
          catalogItem: true,
        },
      })) || updated.moved
    ),
    movementId: updated.movementId,
  };
}

module.exports = { transferAsset };
