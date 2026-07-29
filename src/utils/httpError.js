class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function badRequest(message, code, details) {
  return new HttpError(400, message, code, details);
}

function unauthorized(message = "No autorizado", code, details) {
  return new HttpError(401, message, code, details);
}

function forbidden(message = "Acceso denegado", code, details) {
  return new HttpError(403, message, code, details);
}

function notFound(message = "No encontrado", code, details) {
  return new HttpError(404, message, code, details);
}

function conflict(message = "Conflicto", code, details) {
  return new HttpError(409, message, code, details);
}

function internal(message = "Error interno", code, details) {
  return new HttpError(500, message, code, details);
}

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internal,
};
