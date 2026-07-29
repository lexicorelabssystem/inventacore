const DEFAULT_ERROR_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
  500: "INTERNAL_SERVER_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

function resolveErrorCode(status, code) {
  if (code && typeof code === "string" && code.trim()) {
    return code.trim();
  }
  return DEFAULT_ERROR_CODES[status] || `HTTP_${status}`;
}

function buildErrorPayload({ status, error, code, details, requestId, extra }) {
  const payload = {
    error: error || "Error",
    code: resolveErrorCode(status, code),
    requestId: requestId || null,
  };
  if (details !== undefined) payload.details = details;
  if (extra && typeof extra === "object") {
    Object.assign(payload, extra);
  }
  return payload;
}

function sendError(res, { status, error, code, details, requestId, extra }) {
  return res
    .status(status)
    .json(buildErrorPayload({ status, error, code, details, requestId, extra }));
}

module.exports = {
  resolveErrorCode,
  buildErrorPayload,
  sendError,
};

