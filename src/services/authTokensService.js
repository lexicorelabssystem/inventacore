const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { prisma } = require("../prisma");
const { env } = require("../config/env");
const { unauthorized } = require("../utils/httpError");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role.type,
      establishmentId: user.establishmentId,
      institutionId: user.institutionId,
    },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.refreshToken.create({
    data: { tokenHash, userId, expiresAt },
  });

  return { raw, expiresAt };
}

async function rotateRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized("Refresh token invalido");
  }
  if (!stored.user?.isActive) {
    throw unauthorized("Usuario inactivo");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const next = await issueRefreshToken(stored.userId);
  const accessToken = signAccessToken(stored.user);

  return { accessToken, refresh: next, user: stored.user };
}

async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) return;
  if (!stored.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
  }
}

module.exports = {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
};
