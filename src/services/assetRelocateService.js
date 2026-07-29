const { prisma } = require("../prisma");
const { canRelocateAsset, enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { snapshotAsset } = require("./assetAuditService");
const { notFound, forbidden, conflict } = require("../utils/httpError");

const ASSET_RELOCATE_CONFLICT_CODES = {
  ASSET_DELETED: "ASSET_RELOCATE_ASSET_DELETED",
  SAME_DEPENDENCY: "ASSET_RELOCATE_SAME_DEPENDENCY",
  TARGET_DEPENDENCY_INACTIVE: "ASSET_RELOCATE_TARGET_DEPENDENCY_INACTIVE",
  CROSS_ESTABLISHMENT_FORBIDDEN:
    "ASSET_RELOCATE_CROSS_ESTABLISHMENT_FORBIDDEN",
};

async function relocateAsset(assetId, toDependencyId, user) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) throw notFound("Asset no encontrado");
  if (asset.isDeleted) {
    throw conflict("El asset esta dado de baja", ASSET_RELOCATE_CONFLICT_CODES.ASSET_DELETED);
  }

  enforceEstablishmentScope(user, asset.establishmentId);
  if (!canRelocateAsset(user, asset)) {
    throw forbidden("No autorizado para mover este asset");
  }

  if (asset.dependencyId === toDependencyId) {
    throw conflict(
      "El asset ya esta en ese sector",
      ASSET_RELOCATE_CONFLICT_CODES.SAME_DEPENDENCY
    );
  }

  const toDependency = await prisma.dependency.findUnique({
    where: { id: toDependencyId },
  });

  if (!toDependency) throw notFound("Sector destino no existe");
  if (!toDependency.isActive) {
    throw conflict(
      "Sector destino inactivo",
      ASSET_RELOCATE_CONFLICT_CODES.TARGET_DEPENDENCY_INACTIVE
    );
  }

  if (toDependency.establishmentId !== asset.establishmentId) {
    throw conflict(
      "No se puede reubicar fuera del establecimiento",
      ASSET_RELOCATE_CONFLICT_CODES.CROSS_ESTABLISHMENT_FORBIDDEN
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = snapshotAsset(asset);
    const moved = await tx.asset.update({
      where: { id: assetId },
      data: { dependencyId: toDependencyId },
    });

    await tx.movement.create({
      data: {
        type: "RELOCATION",
        assetId: assetId,
        fromDependencyId: asset.dependencyId,
        toDependencyId: toDependencyId,
        userId: user.id,
      },
    });

    await tx.assetAudit.create({
      data: {
        action: "RELOCATE",
        assetId: assetId,
        userId: user.id,
        before,
        after: snapshotAsset(moved),
      },
    });

    return moved;
  });

  const hydrated = await prisma.asset.findUnique({
    where: { id: updated.id },
    include: {
      assetType: true,
      assetState: true,
      establishment: true,
      dependency: true,
      catalogItem: true,
    },
  });

  return hydrated || updated;
}

module.exports = { relocateAsset };
