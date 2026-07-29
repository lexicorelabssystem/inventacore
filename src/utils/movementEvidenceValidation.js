const { badRequest } = require("./httpError");

const ALLOWED_EVIDENCE_DOC_TYPES = ["FOTO", "ACTA", "FACTURA", "OTRO"];
const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const EVIDENCE_ERROR_CODES = {
  REQUIRED: "EVIDENCE_REQUIRED",
  INVALID_DOC_TYPE: "INVALID_EVIDENCE_DOC_TYPE",
  INVALID_MIME_TYPE: "INVALID_EVIDENCE_MIME_TYPE",
};

function parseRequiredMovementEvidence(payload, file) {
  if (!file?.buffer) {
    throw badRequest(
      "Evidencia obligatoria para este movimiento",
      EVIDENCE_ERROR_CODES.REQUIRED,
      {
        requiredFields: ["file", "docType"],
        allowedDocTypes: ALLOWED_EVIDENCE_DOC_TYPES,
        allowedMimeTypes: ALLOWED_EVIDENCE_MIME_TYPES,
      }
    );
  }

  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.mimetype)) {
    throw badRequest(
      "Tipo de archivo no permitido (usa JPG/PNG/PDF)",
      EVIDENCE_ERROR_CODES.INVALID_MIME_TYPE,
      { allowedMimeTypes: ALLOWED_EVIDENCE_MIME_TYPES }
    );
  }

  const docType = String(payload?.docType || "").trim().toUpperCase();
  if (!ALLOWED_EVIDENCE_DOC_TYPES.includes(docType)) {
    throw badRequest(
      "docType invalido (FOTO, ACTA, FACTURA, OTRO)",
      EVIDENCE_ERROR_CODES.INVALID_DOC_TYPE,
      { allowedDocTypes: ALLOWED_EVIDENCE_DOC_TYPES }
    );
  }

  const note = String(payload?.note || "").trim() || null;
  return {
    docType,
    note,
    fileName: file.originalname || "evidence.bin",
    mimeType: file.mimetype,
    sizeBytes: Number(file.size || file.buffer.length || 0),
    content: file.buffer,
  };
}

module.exports = {
  ALLOWED_EVIDENCE_DOC_TYPES,
  ALLOWED_EVIDENCE_MIME_TYPES,
  EVIDENCE_ERROR_CODES,
  parseRequiredMovementEvidence,
};
