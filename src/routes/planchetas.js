const express = require("express");
const router = express.Router();

const {
  getPlanchetaData,
  getPlanchetaInsights,
  getPlanchetaVisibleCodeStart,
} = require("../services/planchetaService");
const { buildPlanchetaExcel } = require("../services/planchetaExcelService");
const { buildPlanchetaPdf } = require("../services/planchetaPdfService");
const { buildPlanchetaCompactExcel } = require("../services/planchetaCompactExcelService");
const { buildPlanchetaCompactPdf } = require("../services/planchetaCompactPdfService");
const {
  buildPlanchetaDirectoryExcel,
  buildPlanchetaDirectoryPdf,
} = require("../services/planchetaDirectoryExportService");
const { buildPlanchetaExecutiveExcel } = require("../services/planchetaExecutiveExcelService");
const { buildPlanchetaExecutivePdf } = require("../services/planchetaExecutivePdfService");
const { parsePlanchetaFilters } = require("../utils/parsePlanchetaFilters");
const { getAssetHistory } = require("../services/assetHistoryService");
const { sendError } = require("../utils/errorResponse");
const { withSequentialVisibleCode } = require("../utils/assetCode");

const { authJwt } = require("../middleware/authJwt");

router.use(authJwt);

const DEFAULT_MINISTRY_TEXT =
  "Certifico que el presente inventario corresponde a los bienes físicos verificados en el sector indicado, en conformidad con lineamientos ministeriales vigentes.";

function buildDateRangeLabel(filters) {
  if (!filters.fromDate && !filters.toDate) return "Sin filtro";
  if (filters.fromDate && filters.toDate) return `${filters.fromDate} a ${filters.toDate}`;
  if (filters.fromDate) return `Desde ${filters.fromDate}`;
  return `Hasta ${filters.toDate}`;
}

function resolveResponsibleCardName(filters, assets) {
  const explicitFilter = String(filters?.responsibleFilterName || "").trim();
  if (explicitFilter) return explicitFilter;

  const explicitSignature = String(filters?.responsibleName || "").trim();
  if (explicitSignature && explicitSignature.toLowerCase() !== "encargado de sector") {
    return explicitSignature;
  }

  const uniqueResponsibles = Array.from(
    new Set(
      (Array.isArray(assets) ? assets : [])
        .map((asset) => String(asset?.responsibleName || "").trim())
        .filter(Boolean)
    )
  );
  if (uniqueResponsibles.length === 1) return uniqueResponsibles[0];
  if (!uniqueResponsibles.length) return "Sin asignar";
  return "Varios responsables";
}

function compareByInternalCodeAsc(a, b) {
  const leftCode = Number(a?.internalCode);
  const rightCode = Number(b?.internalCode);
  const leftIsNumber = Number.isFinite(leftCode);
  const rightIsNumber = Number.isFinite(rightCode);

  if (leftIsNumber && rightIsNumber && leftCode !== rightCode) {
    return leftCode - rightCode;
  }
  if (leftIsNumber && !rightIsNumber) return -1;
  if (!leftIsNumber && rightIsNumber) return 1;

  const fallback = String(a?.internalCode || "").localeCompare(
    String(b?.internalCode || ""),
    undefined,
    { numeric: true, sensitivity: "base" }
  );
  if (fallback !== 0) return fallback;

  const leftId = Number(a?.id);
  const rightId = Number(b?.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return leftId - rightId;
  }
  return 0;
}

function sortAssetsByInternalCodeAsc(assets) {
  return (Array.isArray(assets) ? [...assets] : []).sort(compareByInternalCodeAsc);
}

async function applyPlanchetaVisibleCodes(filters, user, assets) {
  const sortedAssets = sortAssetsByInternalCodeAsc(assets);
  const startAt = await getPlanchetaVisibleCodeStart(filters, user, sortedAssets);
  return withSequentialVisibleCode(sortedAssets, { startAt });
}

function getGroupFirstInternalCode(group) {
  if (!Array.isArray(group?.assets) || !group.assets.length) return Number.MAX_SAFE_INTEGER;
  const firstCode = Number(group.assets[0]?.internalCode);
  return Number.isFinite(firstCode) ? firstCode : Number.MAX_SAFE_INTEGER;
}

function buildPlanchetaSummary(assets) {
  const map = new Map();

  for (const asset of assets) {
    const dependencyId = asset?.dependency?.id || asset?.dependencyId || 0;
    const dependencyName = asset?.dependency?.name || "Sin sector";
    const category = asset?.catalogItem?.category || "Sin categoría";
    const productName = asset?.catalogItem?.name || asset?.name || "Sin producto";
    const brand = asset?.catalogItem?.brand || asset?.brand || "";
    const modelName = asset?.catalogItem?.modelName || asset?.modelName || "";
    const assetQuantity = Number(asset?.quantity || 1);
    const normalizedQuantity =
      Number.isFinite(assetQuantity) && assetQuantity > 0 ? assetQuantity : 1;
    const key = `${dependencyId}::${productName}::${brand}::${modelName}`;

    if (!map.has(key)) {
      map.set(key, {
        dependencyId,
        dependencyName,
        category,
        productName,
        brand,
        modelName,
        quantity: 0,
      });
    }
    map.get(key).quantity += normalizedQuantity;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.dependencyName !== b.dependencyName) {
      return String(a.dependencyName).localeCompare(String(b.dependencyName));
    }
    if (a.category !== b.category) {
      return String(a.category).localeCompare(String(b.category));
    }
    return String(a.productName).localeCompare(String(b.productName));
  });
}

function buildPlanchetaDirectory(assets) {
  const groups = new Map();

  for (const asset of assets || []) {
    const responsibleName =
      String(asset?.responsibleName || "").trim() || "Sin asignar";
    const responsibleRut = String(asset?.responsibleRut || "").trim();
    const key = `${responsibleName.toLowerCase()}::${responsibleRut.toLowerCase() || "__no_rut__"}`;
    const dependencyName = asset?.dependency?.name || "Sin sector";
    const assetQuantity = Number(asset?.quantity || 1);
    const normalizedQuantity =
      Number.isFinite(assetQuantity) && assetQuantity > 0 ? assetQuantity : 1;
    const movements = Array.isArray(asset?.movements) ? asset.movements : [];
    const latestMovement = movements.length ? movements[0] : null;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        responsibleName,
        responsibleRut,
        responsibleRoles: new Set(),
        costCenters: new Set(),
        dependencies: new Set(),
        assetCount: 0,
        unitCount: 0,
        movementCount: 0,
        latestMovementAt: null,
        assets: [],
      });
    }

    const group = groups.get(key);
    group.assetCount += 1;
    group.unitCount += normalizedQuantity;
    if (asset?.responsibleRole) {
      group.responsibleRoles.add(String(asset.responsibleRole).trim());
    }
    if (asset?.costCenter) {
      group.costCenters.add(String(asset.costCenter).trim());
    }
    if (dependencyName) {
      group.dependencies.add(dependencyName);
    }
    group.movementCount += movements.length;
    if (latestMovement?.createdAt) {
      const latestMovementAt = new Date(latestMovement.createdAt);
      if (
        !group.latestMovementAt ||
        latestMovementAt > new Date(group.latestMovementAt)
      ) {
        group.latestMovementAt = latestMovement.createdAt;
      }
    }
    group.assets.push({
      id: asset.id,
      visibleCode: asset.visibleCode || null,
      internalCode: asset.internalCode,
      name: asset.name,
      brand: asset.brand || "",
      modelName: asset.modelName || "",
      quantity: normalizedQuantity,
      dependencyName,
      assetStateName: asset?.assetState?.name || "Sin estado",
      acquisitionDate: asset.acquisitionDate || null,
      acquisitionValue: asset.acquisitionValue || 0,
      depreciationAnnualValue: asset.depreciationAnnualValue || 0,
      usefulLifeYears: asset.usefulLifeYears || null,
      movements,
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      key: group.key,
      responsibleName: group.responsibleName,
      responsibleRut: group.responsibleRut,
      responsibleRoles: Array.from(group.responsibleRoles).filter(Boolean).sort(),
      costCenters: Array.from(group.costCenters).filter(Boolean).sort(),
      dependencies: Array.from(group.dependencies).filter(Boolean).sort(),
      assetCount: group.assetCount,
      unitCount: group.unitCount,
      movementCount: group.movementCount,
      latestMovementAt: group.latestMovementAt,
      assets: sortAssetsByInternalCodeAsc(group.assets),
    }))
    .sort((a, b) => {
      const codeCompare = getGroupFirstInternalCode(a) - getGroupFirstInternalCode(b);
      if (codeCompare !== 0) {
        return codeCompare;
      }
      const nameCompare = String(a.responsibleName).localeCompare(
        String(b.responsibleName),
        undefined,
        { sensitivity: "base" }
      );
      if (nameCompare !== 0) return nameCompare;
      return String(a.responsibleRut).localeCompare(String(b.responsibleRut), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

// JSON
router.get("/", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const data = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, data);
    const directory = buildPlanchetaDirectory(data);

    const first = data[0];
    const meta = first
      ? {
          institution: first.establishment.institution.name,
          establishment: first.establishment.name,
          rbd: first.establishment.rbd || "",
          commune: first.establishment.commune || "",
          dependency: filters.dependencyId ? first.dependency.name : "Todos",
          dateRange: buildDateRangeLabel(filters),
        }
      : null;

    res.json({
      count: data.length,
      meta,
      summary: buildPlanchetaSummary(data),
      directory,
      insights,
      items: data,
    });
  } catch (e) {
    console.error("plancheta error:", e);
    next(e);
  }
});

// EXCEL
router.get("/excel", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, assets);

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      rbd: assets[0].establishment.rbd || "",
      commune: assets[0].establishment.commune || "",
      dependency: filters.dependencyId
        ? assets[0].dependency.name
        : "Todos",
      dateRange: buildDateRangeLabel(filters),
      responsibleName: resolveResponsibleCardName(filters, assets),
      chiefName: filters.chiefName || "Jefe de Sector",
      ministryText:
        filters.ministryText || DEFAULT_MINISTRY_TEXT,
      insights,
    };

    const workbook = await buildPlanchetaExcel(assets, meta);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("Excel plancheta error:", e);
    next(e);
  }
});

// PDF
router.get("/pdf", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, assets);

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      rbd: assets[0].establishment.rbd || "",
      commune: assets[0].establishment.commune || "",
      dependency: filters.dependencyId
        ? assets[0].dependency.name
        : "Todos",
      dateRange: buildDateRangeLabel(filters),
      responsibleName: resolveResponsibleCardName(filters, assets),
      chiefName: filters.chiefName || "Jefe de Sector",
      ministryText:
        filters.ministryText || DEFAULT_MINISTRY_TEXT,
      insights,
    };

    const doc = buildPlanchetaPdf(assets, meta);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.end();
  } catch (e) {
    console.error("plancheta pdf error:", e);
    next(e);
  }
});

router.get("/compacta/excel", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      rbd: assets[0].establishment.rbd || "",
      commune: assets[0].establishment.commune || "",
      dependency: filters.dependencyId ? assets[0].dependency.name : "Todos",
      dateRange: buildDateRangeLabel(filters),
      responsibleName: resolveResponsibleCardName(filters, assets),
      chiefName: filters.chiefName || "Jefe de Sector",
      ministryText:
        filters.ministryText || DEFAULT_MINISTRY_TEXT,
    };

    const workbook = await buildPlanchetaCompactExcel(assets, meta);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_compacta_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("Excel plancheta compacta error:", e);
    next(e);
  }
});

router.get("/compacta/pdf", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      rbd: assets[0].establishment.rbd || "",
      commune: assets[0].establishment.commune || "",
      dependency: filters.dependencyId ? assets[0].dependency.name : "Todos",
      dateRange: buildDateRangeLabel(filters),
      responsibleName: resolveResponsibleCardName(filters, assets),
      chiefName: filters.chiefName || "Jefe de Sector",
      ministryText:
        filters.ministryText || DEFAULT_MINISTRY_TEXT,
    };

    const doc = buildPlanchetaCompactPdf(assets, meta);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_compacta_${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.end();
  } catch (e) {
    console.error("plancheta compacta pdf error:", e);
    next(e);
  }
});

router.get("/directorio/excel", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, assets);
    const directory = buildPlanchetaDirectory(assets);

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      rbd: assets[0].establishment.rbd || "",
      commune: assets[0].establishment.commune || "",
      dependency: filters.dependencyId ? assets[0].dependency.name : "Todos",
      dateRange: buildDateRangeLabel(filters),
      includeHistory: Boolean(filters.includeHistory),
      ministryText: filters.ministryText || DEFAULT_MINISTRY_TEXT,
      insights,
    };

    const workbook = await buildPlanchetaDirectoryExcel(directory, meta);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_directorio_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("Excel plancheta directorio error:", e);
    next(e);
  }
});

router.get("/directorio/pdf", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, assets);
    const directory = buildPlanchetaDirectory(assets);

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      rbd: assets[0].establishment.rbd || "",
      commune: assets[0].establishment.commune || "",
      dependency: filters.dependencyId ? assets[0].dependency.name : "Todos",
      dateRange: buildDateRangeLabel(filters),
      includeHistory: Boolean(filters.includeHistory),
      ministryText: filters.ministryText || DEFAULT_MINISTRY_TEXT,
      insights,
    };

    const doc = buildPlanchetaDirectoryPdf(directory, meta);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_directorio_${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.end();
  } catch (e) {
    console.error("plancheta directorio pdf error:", e);
    next(e);
  }
});

router.get("/gerencial/excel", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, assets);

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      dependency: filters.dependencyId ? assets[0].dependency.name : "Todos",
      dateRange: buildDateRangeLabel(filters),
      ministryText: filters.ministryText || DEFAULT_MINISTRY_TEXT,
      insights,
    };

    const workbook = await buildPlanchetaExecutiveExcel(assets, meta);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_gerencial_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("Excel plancheta gerencial error:", e);
    next(e);
  }
});

router.get("/gerencial/pdf", async (req, res, next) => {
  try {
    const filters = parsePlanchetaFilters(req.query);
    const assets = await applyPlanchetaVisibleCodes(
      filters,
      req.user,
      await getPlanchetaData(filters, req.user)
    );
    const insights = await getPlanchetaInsights(filters, req.user, assets);

    if (!assets.length) {
      return sendError(res, {
        status: 404,
        error: "No hay assets para exportar",
        code: "PLANCHETA_EMPTY_EXPORT",
        requestId: req.id,
      });
    }

    const meta = {
      institution: assets[0].establishment.institution.name,
      establishment: assets[0].establishment.name,
      dependency: filters.dependencyId ? assets[0].dependency.name : "Todos",
      dateRange: buildDateRangeLabel(filters),
      ministryText: filters.ministryText || DEFAULT_MINISTRY_TEXT,
      insights,
    };

    const doc = buildPlanchetaExecutivePdf(assets, meta);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plancheta_gerencial_${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.end();
  } catch (e) {
    console.error("plancheta gerencial pdf error:", e);
    next(e);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const assetId = Number(req.params.id);
    if (!Number.isFinite(assetId)) {
      return sendError(res, {
        status: 400,
        error: "id invalido",
        code: "INVALID_ASSET_ID",
        requestId: req.id,
      });
    }

    const history = await getAssetHistory(assetId, req.user);
    res.json({ count: history.length, items: history });
  } catch (e) {
    console.error("asset history error:", e);
    next(e);
  }
});

module.exports = { planchetasRouter: router };

