const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede ver importaciones");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function listAssetImportBatches(query, user) {
  requireCentral(user);
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const userId = query.userId ? Number(query.userId) : undefined;
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
  const toDate = query.toDate ? new Date(query.toDate) : undefined;

  const where = {
    ...(userId ? { userId } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const items = await prisma.assetImportBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const total = await prisma.assetImportBatch.count({ where });
  return { total, skip, take, items };
}

module.exports = { listAssetImportBatches };
