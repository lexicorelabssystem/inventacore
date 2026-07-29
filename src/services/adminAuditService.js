const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede ver auditoria admin");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function logAdminAudit({ userId, entityType, action, entityId, before, after, db = prisma }) {
  return db.adminAudit.create({
    data: {
      userId,
      entityType,
      action,
      entityId,
      before: before || null,
      after: after || null,
    },
  });
}

async function listAdminAudits(query, user) {
  requireCentral(user);
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);

  const where = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
  };

  if (query.fromDate || query.toDate) {
    where.createdAt = {
      ...(query.fromDate ? { gte: query.fromDate } : {}),
      ...(query.toDate ? { lte: query.toDate } : {}),
    };
  }

  const items = await prisma.adminAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const total = await prisma.adminAudit.count({ where });

  return { total, skip, take, items };
}

module.exports = { logAdminAudit, listAdminAudits };
