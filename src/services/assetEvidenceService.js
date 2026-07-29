const { prisma } = require("../prisma");
const { enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { badRequest, notFound } = require("../utils/httpError");
const {
  ALLOWED_EVIDENCE_DOC_TYPES,
  ALLOWED_EVIDENCE_MIME_TYPES,
} = require("../utils/movementEvidenceValidation");

const ALLOWED_DOC_TYPES = new Set(ALLOWED_EVIDENCE_DOC_TYPES);
const ALLOWED_MIME_TYPES = new Set(ALLOWED_EVIDENCE_MIME_TYPES);
const ALLOWED_MOVEMENT_TYPES_FOR_EVIDENCE = new Set([
  "TRANSFER",
  "RELOCATION",
  "STATUS_CHANGE",
  "INVENTORY_CHECK",
]);

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function ensureAssetScope(assetId, user) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, establishmentId: true },
  });
  if (!asset) throw notFound("Asset no encontrado");
  enforceEstablishmentScope(user, asset.establishmentId);
  return asset;
}

async function createAssetEvidence(assetId, payload, file, user) {
  await ensureAssetScope(assetId, user);

  if (!file?.buffer) throw badRequest("Archivo requerido");
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw badRequest("Tipo de archivo no permitido (usa JPG/PNG/PDF)");
  }

  const docType = String(payload?.docType || "").trim().toUpperCase();
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    throw badRequest("docType invalido (FOTO, ACTA, FACTURA, OTRO)");
  }

  const note = String(payload?.note || "").trim() || null;
  const movementIdRaw = payload?.movementId;
  const movementId =
    movementIdRaw !== undefined && movementIdRaw !== null && movementIdRaw !== ""
      ? Number(movementIdRaw)
      : null;

  if (movementId !== null) {
    if (!Number.isInteger(movementId) || movementId <= 0) {
      throw badRequest("movementId invalido");
    }
    const movement = await prisma.movement.findUnique({
      where: { id: movementId },
      select: { id: true, assetId: true, type: true },
    });
    if (!movement || movement.assetId !== assetId) {
      throw badRequest("movementId no pertenece a este asset");
    }
    if (!ALLOWED_MOVEMENT_TYPES_FOR_EVIDENCE.has(movement.type)) {
      throw badRequest("No se permite adjuntar evidencia al tipo de movimiento seleccionado");
    }
  }

  const created = await prisma.assetEvidence.create({
    data: {
      assetId,
      movementId,
      uploadedById: user.id,
      docType,
      note,
      fileName: file.originalname || "evidence.bin",
      mimeType: file.mimetype,
      sizeBytes: Number(file.size || file.buffer.length || 0),
      content: file.buffer,
    },
    select: {
      id: true,
      assetId: true,
      movementId: true,
      uploadedById: true,
      docType: true,
      note: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return created;
}

async function listAssetEvidence(assetId, query, user) {
  await ensureAssetScope(assetId, user);

  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const movementId =
    query.movementId !== undefined ? Number(query.movementId) : undefined;

  const where = {
    assetId,
    ...(Number.isInteger(movementId) && movementId > 0 ? { movementId } : {}),
  };

  const items = await prisma.assetEvidence.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
    select: {
      id: true,
      assetId: true,
      movementId: true,
      uploadedById: true,
      docType: true,
      note: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
  const total = await prisma.assetEvidence.count({ where });
  return { total, skip, take, items };
}

async function getAssetEvidenceFile(assetId, evidenceId, user) {
  await ensureAssetScope(assetId, user);

  const evidence = await prisma.assetEvidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      assetId: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      content: true,
    },
  });
  if (!evidence || evidence.assetId !== assetId) {
    throw notFound("Evidencia no encontrada");
  }
  return evidence;
}

module.exports = {
  createAssetEvidence,
  listAssetEvidence,
  getAssetEvidenceFile,
};
