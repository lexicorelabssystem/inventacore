const { prisma } = require("../prisma");
const { notFound, forbidden } = require("../utils/httpError");

async function getAssetById(assetId, user) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      assetType: true,
      assetState: true,
      establishment: true,
      dependency: true,
      catalogItem: true,
      movements: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) {
    throw notFound("Asset no encontrado");
  }

  // Control de permisos
  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    if (asset.establishmentId !== user.establishmentId) {
      throw forbidden("Acceso denegado a este asset");
    }
  }

  return asset;
}

module.exports = { getAssetById };
