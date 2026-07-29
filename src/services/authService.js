const { prisma } = require("../prisma");
const { verifyPassword, hashPassword } = require("../utils/password");
const { unauthorized, badRequest } = require("../utils/httpError");
const { logLoginAttempt } = require("./loginAuditService");
const { signAccessToken, issueRefreshToken } = require("./authTokensService");

function toPhotoDataUrl(photo) {
  if (!photo?.content || !photo?.mimeType) return null;
  const base64 = Buffer.from(photo.content).toString("base64");
  return `data:${photo.mimeType};base64,${base64}`;
}

async function safeLogLoginAttempt(payload) {
  try {
    await logLoginAttempt(payload);
  } catch (_err) {
    // Login must not fail because of audit persistence problems.
  }
}

async function login(email, password, ip) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, photo: true },
  });

  if (!user) {
    await safeLogLoginAttempt({ email, ip, success: false, reason: "USER_NOT_FOUND" });
    throw unauthorized("Credenciales invalidas");
  }

  if (!user.isActive) {
    await safeLogLoginAttempt({
      email,
      ip,
      userId: user.id,
      success: false,
      reason: "USER_INACTIVE",
    });
    throw unauthorized("Usuario inactivo");
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    await safeLogLoginAttempt({
      email,
      ip,
      userId: user.id,
      success: false,
      reason: "INVALID_PASSWORD",
    });
    throw unauthorized("Credenciales invalidas");
  }

  const accessToken = signAccessToken(user);
  const refresh = await issueRefreshToken(user.id);

  await safeLogLoginAttempt({
    email,
    ip,
    userId: user.id,
    success: true,
  });

  return {
    accessToken,
    refreshToken: refresh.raw,
    refreshExpiresAt: refresh.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      role: user.role.type,
      establishmentId: user.establishmentId,
      hasPhoto: Boolean(user.photo),
      photoDataUrl: user.photo ? toPhotoDataUrl(user.photo) : null,
    },
  };
}

async function changeOwnPassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, isActive: true, password: true },
  });

  if (!user || !user.isActive) {
    throw unauthorized("No autorizado", "UNAUTHORIZED");
  }

  const validCurrent = await verifyPassword(currentPassword, user.password);
  if (!validCurrent) {
    throw badRequest("La clave actual no coincide", "PASSWORD_CURRENT_INVALID");
  }

  const samePassword = await verifyPassword(newPassword, user.password);
  if (samePassword) {
    throw badRequest("La nueva clave debe ser distinta", "PASSWORD_NEW_SAME_AS_CURRENT");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash },
  });

  return { ok: true };
}

module.exports = { login, changeOwnPassword };
