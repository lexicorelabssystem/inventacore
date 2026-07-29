const jwt = require("jsonwebtoken");
const { prisma } = require("../prisma");
const { unauthorized } = require("../utils/httpError");

const { env } = require("../config/env");
const JWT_SECRET = env.JWT_SECRET;

async function authJwt(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return next(unauthorized("Token requerido"));

  const token = auth.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });

    if (!user) return next(unauthorized("Usuario no existe"));
    if (!user.isActive) return next(unauthorized("Usuario inactivo"));

    req.user = user;
    return next();
  } catch (e) {
    return next(unauthorized("Token invalido"));
  }
}

module.exports = { authJwt };
