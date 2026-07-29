const { HttpError } = require("../utils/httpError");
const { buildErrorPayload } = require("../utils/errorResponse");

function errorHandler(err, req, res, next) {
  const isHttpError = err instanceof HttpError;
  const isZodError = err?.name === "ZodError";

  let status = 500;
  let code = null;
  let details = undefined;

  if (isZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    details = err.issues?.map((i) => ({
      path: i.path?.join("."),
      message: i.message,
    }));
  } else if (isHttpError) {
    status = err.status;
    code = err.code || null;
    details = err.details;
  }

  if (status === 500) {
    console.error("Unhandled error:", err);
  }

  const message =
    status === 500 ? "Error interno del servidor" : err.message || "Error";

  const payload = buildErrorPayload({
    status,
    error: message,
    code,
    details,
    requestId: req.id,
  });
  if (status === 500 && process.env.NODE_ENV !== "production") {
    payload.devMessage = err?.message || null;
  }

  res.status(status).json(payload);
}

module.exports = { errorHandler };
