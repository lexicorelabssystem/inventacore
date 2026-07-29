const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");

function requireCentral(user) {
  if (user?.role?.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede limpiar auditoria");
  }
}

function toDateStart(value) {
  const d = new Date(`${String(value)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function resolveBeforeDate(input) {
  if (input.mode === "BEFORE_DATE") return toDateStart(input.beforeDate);
  if (input.mode === "KEEP_DAYS") {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - Number(input.keepDays));
    cutoff.setUTCHours(0, 0, 0, 0);
    return cutoff;
  }
  return null;
}

async function cleanupAudits(payload, user) {
  requireCentral(user);
  const beforeDate = resolveBeforeDate(payload);
  const where = beforeDate ? { createdAt: { lt: beforeDate } } : {};

  const result = {
    scope: payload.scope,
    mode: payload.mode,
    beforeDate: beforeDate ? beforeDate.toISOString() : null,
    deleted: {
      adminAudit: 0,
      loginAudit: 0,
    },
  };

  if (payload.scope === "ADMIN" || payload.scope === "ALL") {
    const deletedAdmin = await prisma.adminAudit.deleteMany({ where });
    result.deleted.adminAudit = deletedAdmin.count || 0;
  }
  if (payload.scope === "LOGIN" || payload.scope === "ALL") {
    const deletedLogin = await prisma.loginAudit.deleteMany({ where });
    result.deleted.loginAudit = deletedLogin.count || 0;
  }

  return result;
}

module.exports = { cleanupAudits };

