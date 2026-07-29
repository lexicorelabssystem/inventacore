// src/middleware/auth.js
const { prisma } = require("../prisma");
const { unauthorized, forbidden } = require("../utils/httpError");

async function authMock(req, res, next) {
  const raw = req.header("x-user-id");
  const userId = Number(raw);

  if (!Number.isFinite(userId)) {
    return next(unauthorized("Falta x-user-id (number)"));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) return next(unauthorized("Usuario no existe"));

  req.user = user;
  next();
}

function requireReadOnly(req, res, next) {
  if (req.user?.role?.type === "VIEWER") {
    return next(); // viewer puede leer
  }
  return next();
}

function blockWriteForViewer(req, res, next) {
  if (req.user?.role?.type === "VIEWER") {
    return next(forbidden("VIEWER no puede modificar"));
  }
  next();
}

module.exports = { authMock, blockWriteForViewer };
