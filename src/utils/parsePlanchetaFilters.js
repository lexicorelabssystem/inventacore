// src/utils/parsePlanchetaFilters.js
function toInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parsePlanchetaFilters(query) {
  const dependencyId = toInt(query.dependencyId ?? query.sectorId);
  const sectorId = toInt(query.sectorId ?? query.dependencyId);
  return {
    dependencyId,
    sectorId,
    establishmentId: toInt(query.establishmentId),
    fromDate: String(query.fromDate || "").trim(),
    toDate: String(query.toDate || "").trim(),
    // Requisito operativo: la plancheta no debe incluir activos dados de baja.
    includeHistory: false,
    responsibleFilterName: String(
      query.responsibleFilterName ?? query.responsibleAssetName ?? ""
    ).trim(),
    responsibleName: String(query.responsibleName || "").trim(),
    chiefName: String(query.chiefName || "").trim(),
    ministryText: String(query.ministryText || "").trim(),
  };
}

module.exports = { parsePlanchetaFilters };
