const { conflict } = require("./httpError");

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out || null;
}

async function ensureUniqueAssetIdentity(db, { serialNumber, brand, modelName, excludeId }) {
  const serial = normalizeText(serialNumber);
  const brandNorm = normalizeText(brand);
  const modelNorm = normalizeText(modelName);

  // Se valida duplicidad solo cuando existe la triada completa.
  if (!serial || !brandNorm || !modelNorm) return;

  const where = {
    isDeleted: false,
    serialNumber: { equals: serial, mode: "insensitive" },
    brand: { equals: brandNorm, mode: "insensitive" },
    modelName: { equals: modelNorm, mode: "insensitive" },
    ...(excludeId ? { NOT: { id: excludeId } } : {}),
  };

  const duplicate = await db.asset.findFirst({
    where,
    select: {
      id: true,
      internalCode: true,
      serialNumber: true,
      brand: true,
      modelName: true,
      establishmentId: true,
      dependencyId: true,
    },
  });

  if (!duplicate) return;

  throw conflict("Ya existe un asset activo con la misma serie, marca y modelo");
}

module.exports = { ensureUniqueAssetIdentity, normalizeText };
