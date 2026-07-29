const { prisma } = require("../prisma");

async function logLoginAttempt({ email, ip, userId, success, reason }) {
  return prisma.loginAudit.create({
    data: {
      email,
      ip,
      userId: userId || null,
      success,
      reason: reason || null,
    },
  });
}

module.exports = { logLoginAttempt };
