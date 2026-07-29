const { sendError } = require("../utils/errorResponse");

function limitContentLength(maxBytes) {
  return function limitContentLengthMiddleware(req, res, next) {
    const raw = req.headers["content-length"];
    if (!raw) return next();
    const length = Number(raw);
    if (Number.isFinite(length) && length > maxBytes) {
      return sendError(res, {
        status: 413,
        error: "Payload demasiado grande",
        code: "PAYLOAD_TOO_LARGE",
        requestId: req.id,
      });
    }
    return next();
  };
}

module.exports = { limitContentLength };
