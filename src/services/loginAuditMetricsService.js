const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede ver metricas de login");
  }
}

async function getLoginAuditMetrics(query, user) {
  requireCentral(user);
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
  const toDate = query.toDate ? new Date(query.toDate) : undefined;
  const hourFrom = query.hourFrom !== undefined ? Number(query.hourFrom) : null;
  const hourTo = query.hourTo !== undefined ? Number(query.hourTo) : null;

  const rows = await prisma.$queryRaw`
    SELECT DATE("createdAt") as day,
           SUM(CASE WHEN "success" = true THEN 1 ELSE 0 END) AS success,
           SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) AS failed
    FROM "LoginAudit"
    WHERE ("createdAt" >= COALESCE(${fromDate}, "createdAt"))
      AND ("createdAt" <= COALESCE(${toDate}, "createdAt"))
      AND (EXTRACT(HOUR FROM "createdAt") >= COALESCE(${hourFrom}, EXTRACT(HOUR FROM "createdAt")))
      AND (EXTRACT(HOUR FROM "createdAt") <= COALESCE(${hourTo}, EXTRACT(HOUR FROM "createdAt")))
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((r) => ({
    day: r.day,
    success: Number(r.success || 0),
    failed: Number(r.failed || 0),
  }));
}

async function getLoginAuditMetricsHourly(query, user) {
  requireCentral(user);
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
  const toDate = query.toDate ? new Date(query.toDate) : undefined;
  const hourFrom = query.hourFrom !== undefined ? Number(query.hourFrom) : null;
  const hourTo = query.hourTo !== undefined ? Number(query.hourTo) : null;

  const rows = await prisma.$queryRaw`
    SELECT DATE_TRUNC('hour', "createdAt") as hour,
           SUM(CASE WHEN "success" = true THEN 1 ELSE 0 END) AS success,
           SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) AS failed
    FROM "LoginAudit"
    WHERE ("createdAt" >= COALESCE(${fromDate}, "createdAt"))
      AND ("createdAt" <= COALESCE(${toDate}, "createdAt"))
      AND (EXTRACT(HOUR FROM "createdAt") >= COALESCE(${hourFrom}, EXTRACT(HOUR FROM "createdAt")))
      AND (EXTRACT(HOUR FROM "createdAt") <= COALESCE(${hourTo}, EXTRACT(HOUR FROM "createdAt")))
    GROUP BY hour
    ORDER BY hour ASC
  `;

  return rows.map((r) => ({
    hour: r.hour,
    success: Number(r.success || 0),
    failed: Number(r.failed || 0),
  }));
}

async function getLoginAuditMetricsByIp(query, user) {
  requireCentral(user);
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
  const toDate = query.toDate ? new Date(query.toDate) : undefined;
  const hourFrom = query.hourFrom !== undefined ? Number(query.hourFrom) : null;
  const hourTo = query.hourTo !== undefined ? Number(query.hourTo) : null;

  const rows = await prisma.$queryRaw`
    SELECT "ip", "success", COUNT(*) as count
    FROM "LoginAudit"
    WHERE ("createdAt" >= COALESCE(${fromDate}, "createdAt"))
      AND ("createdAt" <= COALESCE(${toDate}, "createdAt"))
      AND (EXTRACT(HOUR FROM "createdAt") >= COALESCE(${hourFrom}, EXTRACT(HOUR FROM "createdAt")))
      AND (EXTRACT(HOUR FROM "createdAt") <= COALESCE(${hourTo}, EXTRACT(HOUR FROM "createdAt")))
    GROUP BY "ip", "success"
  `;

  const map = {};
  rows.forEach((r) => {
    const key = r.ip;
    if (!map[key]) map[key] = { ip: key, success: 0, failed: 0 };
    if (r.success) map[key].success += Number(r.count || 0);
    else map[key].failed += Number(r.count || 0);
  });

  return Object.values(map).sort((a, b) => b.failed - a.failed);
}

async function getLoginAuditMetricsByUser(query, user) {
  requireCentral(user);
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
  const toDate = query.toDate ? new Date(query.toDate) : undefined;
  const hourFrom = query.hourFrom !== undefined ? Number(query.hourFrom) : null;
  const hourTo = query.hourTo !== undefined ? Number(query.hourTo) : null;

  const rows = await prisma.$queryRaw`
    SELECT "userId", "success", COUNT(*) as count
    FROM "LoginAudit"
    WHERE ("createdAt" >= COALESCE(${fromDate}, "createdAt"))
      AND ("createdAt" <= COALESCE(${toDate}, "createdAt"))
      AND (EXTRACT(HOUR FROM "createdAt") >= COALESCE(${hourFrom}, EXTRACT(HOUR FROM "createdAt")))
      AND (EXTRACT(HOUR FROM "createdAt") <= COALESCE(${hourTo}, EXTRACT(HOUR FROM "createdAt")))
    GROUP BY "userId", "success"
  `;

  const map = {};
  const userIds = new Set();
  rows.forEach((r) => {
    const key = r.userId || 0;
    if (key) userIds.add(key);
    if (!map[key]) map[key] = { userId: r.userId, success: 0, failed: 0 };
    if (r.success) map[key].success += Number(r.count || 0);
    else map[key].failed += Number(r.count || 0);
  });

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = {};
  users.forEach((u) => {
    userMap[u.id] = u;
  });

  return Object.values(map)
    .map((r) => ({
      ...r,
      user: r.userId ? userMap[r.userId] : null,
    }))
    .sort((a, b) => b.failed - a.failed);
}

module.exports = {
  getLoginAuditMetrics,
  getLoginAuditMetricsHourly,
  getLoginAuditMetricsByIp,
  getLoginAuditMetricsByUser,
};
