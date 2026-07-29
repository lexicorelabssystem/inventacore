const { prisma } = require("../prisma");
const { notFound, forbidden } = require("../utils/httpError");

async function getAssetHistory(assetId, user) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      establishmentId: true,
    },
  });

  if (!asset) throw notFound("Asset no encontrado");

  // Permisos
  if (
    user.role.type === "ADMIN_ESTABLISHMENT" &&
    asset.establishmentId !== user.establishmentId
  ) {
    throw forbidden("Acceso denegado a este asset");
  }

  return prisma.movement.findMany({
    where: { assetId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      fromDependency: { select: { id: true, name: true } },
      toDependency: { select: { id: true, name: true } },
    },
  });
}

module.exports = { getAssetHistory };
