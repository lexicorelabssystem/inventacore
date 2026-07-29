const { sendError } = require("../utils/errorResponse");

function notFound(req, res, next) {
  sendError(res, {
    status: 404,
    error: "Ruta no encontrada",
    code: "ROUTE_NOT_FOUND",
    requestId: req.id,
    extra: {
      method: req.method,
      path: req.originalUrl,
      hint: "Usa /health, /auth/*, /assets/*, /catalog/*, /admin/* (o prefijo /api)",
    },
  });
}

module.exports = { notFound };
