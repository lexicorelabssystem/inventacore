const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function getAuditLog(filters, user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede ver auditoria");
  }

  const take = clampTake(filters.take);
  const skip = clampSkip(filters.skip);
  const sortOrder = filters.sortOrder || "desc";

  const where = {
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  if (filters.fromDate || filters.toDate) {
    where.createdAt = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { asset: { name: { contains: q, mode: "insensitive" } } },
        { asset: { internalCode: Number(q) || -1 } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }
  }

  const items = await prisma.movement.findMany({
    where,
    orderBy: { createdAt: sortOrder },
    skip,
    take,
    include: {
      asset: {
        select: {
          id: true,
          internalCode: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      fromDependency: true,
      toDependency: true,
    },
  });

  const total = await prisma.movement.count({ where });

  return { total, skip, take, items };
}

module.exports = { getAuditLog };
