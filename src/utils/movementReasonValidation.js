const { badRequest } = require("./httpError");
const { MOVEMENT_REASON_CODES } = require("../constants/movementReasonCodes");

const REASON_CODE_ERROR_CODES = {
  MISSING: "MISSING_REASON_CODE",
  INVALID: "INVALID_REASON_CODE",
};

function normalizeReasonCode(value) {
  return String(value || "").trim().toUpperCase();
}

function requireReasonCode(scope, reasonCode) {
  const allowed = MOVEMENT_REASON_CODES[scope] || [];
  const normalized = normalizeReasonCode(reasonCode);

  if (!normalized) {
    throw badRequest(
      "reasonCode requerido",
      REASON_CODE_ERROR_CODES.MISSING,
      { scope, allowed }
    );
  }

  if (!allowed.includes(normalized)) {
    throw badRequest(
      "reasonCode invalido",
      REASON_CODE_ERROR_CODES.INVALID,
      { scope, allowed }
    );
  }

  return normalized;
}

module.exports = {
  REASON_CODE_ERROR_CODES,
  requireReasonCode,
};

