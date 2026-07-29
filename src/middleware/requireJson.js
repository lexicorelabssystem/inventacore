const { sendError } = require("../utils/errorResponse");

function requireJson(req, res, next) {
  if (!req.is("application/json")) {
    return sendError(res, {
      status: 415,
      error: "Content-Type debe ser application/json",
      code: "UNSUPPORTED_MEDIA_TYPE",
      requestId: req.id,
    });
  }
  return next();
}

module.exports = { requireJson };
