const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { prisma } = require("../prisma");
const { canCreateAsset, enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const {
  validateAcquisitionDate,
  validateAcquisitionValue,
  validateDateNotFuture,
  validateStringMax,
  MAX_NAME_LENGTH,
  MAX_SHORT_TEXT,
  normalizeCostCenter,
  normalizeRut,
  normalizeDepreciationRate,
  resolveDepreciationValues,
  validateUsefulLifeYears,
  validateDepreciationAnnualValue,
  validateDepreciationAnnualRate,
} = require("../utils/assetRules");
const { ensureUniqueAssetIdentity, normalizeText } = require("../utils/assetIdentity");
const {
  estimateUsefulLifeYearsChile,
  resolveUsefulLifeYearsFromPolicies,
} = require("../utils/chileDepreciationTable");

const HEADER_ALIASES = {
  codigo: "internalcode",
  codigointerno: "internalcode",
  codigomau: "internalcode",
  codigoval: "internalcode",
  nombre: "name",
  nombredelbien: "name",
  marca: "brand",
  modelo: "modelname",
  serie: "serialnumber",
  cuentacontable: "accountingaccount",
  cuentanombre: "accountingaccount",
  analitico: "analyticcode",
  tipo: "assettype",
  estado: "assetstatename",
  establecimiento: "establishmentname",
  establecimientooficinarfetc: "establishmentname",
  dependencia: "dependencyname",
  sector: "dependencyname",
  valor: "acquisitionvalue",
  valoradquisicion: "acquisitionvalue",
  fechaalta: "acquisitiondate",
  fechaadquisicion: "acquisitiondate",
  cantidad: "quantity",
  rutresponsable: "responsiblerut",
  responsablerut: "responsiblerut",
  responsable: "responsiblename",
  cargoresponsable: "responsiblerole",
  centrocosto: "costcenter",
  centrodecosto: "costcenter",
  depreciacion: "depreciationannualvalue",
  depreciacionanual: "depreciationannualvalue",
  depreciacionanualclp: "depreciationannualvalue",
  depreciacionanualclptasadepreciacionanual: "depreciationannualvalue",
  depreciacionanualvalor: "depreciationannualvalue",
  depreciacionanualmonto: "depreciationannualvalue",
  depreciaciontasaanual: "depreciationannualrate",
  tasadepreciacionanual: "depreciationannualrate",
  tasadepreciacion: "depreciationannualrate",
  fechainiciodepreciacion: "depreciationstartdate",
  iniciodepreciacion: "depreciationstartdate",
  depreciacioninicio: "depreciationstartdate",
  depreciationstartdate: "depreciationstartdate",
  vidautil: "usefullifeyears",
  vidautilanos: "usefullifeyears",
  anosvidautil: "usefullifeyears",
  aniosvidautil: "usefullifeyears",
  usefullifeyears: "usefullifeyears",
};

const IMPORT_PLACEHOLDER_TEXTS = new Set([
  "s/i",
  "si",
  "n/a",
  "na",
  "por informar",
  "por asignar",
  "sin informacion",
  "sin informacion.",
  "sin info",
  "no informa",
  "no informado",
]);

const IMPORT_CHUNK_SIZE = 25;
const IMPORT_PROGRESS_FLUSH_EVERY = 10;
const IMPORT_TMP_DIR = path.join(os.tmpdir(), "inventacore", "asset-imports");

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function getRowValue(row, keyMap, key) {
  const col = keyMap[key];
  if (!col) return undefined;
  return row.getCell(col).value;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInt(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function normalizeImportText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isImportPlaceholder(value) {
  const normalized = normalizeImportText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return IMPORT_PLACEHOLDER_TEXTS.has(normalized);
}

function normalizeOptionalImportValue(value) {
  if (value === undefined || value === null) return null;
  if (isImportPlaceholder(value)) return null;
  const text = normalizeImportText(value);
  return text ? text : null;
}

function normalizeImportRutValue(value) {
  const raw = normalizeOptionalImportValue(value);
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/^'+/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!cleaned) return null;
  return normalizeRut(cleaned) || null;
}

function parseImportAcquisitionValue(value) {
  if (value === undefined || value === null || normalizeImportText(value) === "") return 1;
  if (isImportPlaceholder(value)) return 1;
  const num = Number(value);
  return Number.isFinite(num) ? num : Number.NaN;
}

function parseImportAcquisitionDate(value) {
  if (value === undefined || value === null || normalizeImportText(value) === "") {
    return new Date();
  }
  if (isImportPlaceholder(value)) return new Date();
  return parseExcelDate(value);
}

function parseImportOptionalDate(value) {
  if (value === undefined || value === null || normalizeImportText(value) === "") {
    return null;
  }
  if (isImportPlaceholder(value)) return null;
  return parseExcelDate(value);
}

function readNumericCellValue(value) {
  if (value === undefined || value === null || value === "") return null;
  if (isImportPlaceholder(value)) return null;
  if (typeof value === "object") {
    if (value?.result !== undefined) return readNumericCellValue(value.result);
    if (value?.text !== undefined) return readNumericCellValue(value.text);
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;

  const text = String(value).trim();
  if (!text) return null;

  const cleaned = text.replace(/[^\d.,%-]/g, "");
  if (!cleaned) return Number.NaN;
  if (cleaned.includes("%")) {
    const numericPart = cleaned.replace(/%/g, "");
    const percentValue = readNumericCellValue(numericPart);
    if (percentValue === null) return null;
    if (!Number.isFinite(percentValue)) return Number.NaN;
    return percentValue / 100;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const commaParts = cleaned.split(",");
    normalized =
      commaParts.length === 2 && commaParts[1].length <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseImportUsefulLifeYears(value) {
  const raw = readNumericCellValue(value);
  if (raw === null) return null;
  if (!Number.isFinite(raw)) return Number.NaN;
  if (!Number.isInteger(raw)) return Number.NaN;
  return raw;
}

function parseImportDepreciationAnnualValue(value) {
  const raw = readNumericCellValue(value);
  if (raw === null) return null;
  if (!Number.isFinite(raw)) return Number.NaN;
  return raw;
}

function parseImportDepreciationAnnualRate(value) {
  const raw = readNumericCellValue(value);
  if (raw === null) return null;
  if (!Number.isFinite(raw)) return Number.NaN;
  return normalizeDepreciationRate(raw);
}

function hasPercentMarker(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "object") {
    if (value?.result !== undefined) return hasPercentMarker(value.result);
    if (value?.text !== undefined) return hasPercentMarker(value.text);
  }
  return String(value).includes("%");
}

function normalizeLookupValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isPrismaUniqueConstraintError(err) {
  if (!err) return false;
  if (err.code === "P2002") return true;
  if (err.name === "PrismaClientKnownRequestError" && err.message) {
    return String(err.message).includes("Unique constraint failed");
  }
  return false;
}

function isInternalCodeUniqueConstraintError(err) {
  if (!isPrismaUniqueConstraintError(err)) return false;
  const targets = Array.isArray(err?.meta?.target)
    ? err.meta.target
    : err?.meta?.target
      ? [err.meta.target]
      : [];
  if (targets.some((target) => String(target).toLowerCase().includes("internalcode"))) {
    return true;
  }
  return String(err?.message || "").toLowerCase().includes("internalcode");
}

async function reserveInternalCodes(tx, institutionId, quantity) {
  const safeQuantity = Number(quantity) || 1;
  const seq = await tx.assetSequence.upsert({
    where: { institutionId },
    update: { lastNumber: { increment: safeQuantity } },
    create: { institutionId, lastNumber: safeQuantity },
    select: { lastNumber: true },
  });

  const reservedEnd = seq.lastNumber;
  const reservedStart = reservedEnd - safeQuantity + 1;
  const reservedCodes = Array.from({ length: safeQuantity }, (_, index) => reservedStart + index);
  const occupiedCodes = await tx.asset.findMany({
    where: { internalCode: { gte: reservedStart, lte: reservedEnd } },
    select: { internalCode: true },
  });
  if (!occupiedCodes.length) {
    return reservedCodes;
  }

  const occupiedSet = new Set(
    occupiedCodes
      .map((item) => Number(item.internalCode))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  const maxCode = await tx.asset.aggregate({ _max: { internalCode: true } });
  let nextCode = Math.max(Number(maxCode?._max?.internalCode || 0), reservedEnd) + 1;
  const finalCodes = reservedCodes.map((code) => {
    if (!occupiedSet.has(code)) return code;
    const replacement = nextCode;
    nextCode += 1;
    return replacement;
  });

  const extraReserved = nextCode - 1 - reservedEnd;
  if (extraReserved > 0) {
    await tx.assetSequence.update({
      where: { institutionId },
      data: { lastNumber: { increment: extraReserved } },
    });
  }

  return finalCodes;
}

function buildAssetIdentityKey({ serialNumber, brand, modelName }) {
  const serial = normalizeText(serialNumber);
  const brandNorm = normalizeText(brand);
  const modelNorm = normalizeText(modelName);
  if (!serial || !brandNorm || !modelNorm) return null;
  return [serial, brandNorm, modelNorm].map((value) => value.toLowerCase()).join("::");
}

function isSummaryImportName(value) {
  return ["total", "totales"].includes(
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
  );
}

function countProcessableImportRows(sheet, keyMap, dataStartRow = 2, dataEndRow = null) {
  const sheetLastRow = sheet?.lastRow ? sheet.lastRow.number : 1;
  const lastRow = dataEndRow ? Math.min(sheetLastRow, dataEndRow) : sheetLastRow;
  let total = 0;
  for (let rowIndex = dataStartRow; rowIndex <= lastRow; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    if (row.hidden) continue;
    const rowHasData =
      Array.isArray(row.values) &&
      row.values.slice(1).some((value) => normalizeImportText(value) !== "");
    if (!rowHasData) continue;
    const name = normalizeOptionalImportValue(getRowValue(row, keyMap, "name"));
    const code = normalizeOptionalImportValue(getRowValue(row, keyMap, "internalcode"));
    if (isSummaryImportName(name) || isSummaryImportName(code)) continue;
    total += 1;
  }
  return total;
}

function sanitizeImportFilename(filename) {
  const base = String(filename || "import.xlsx")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim();
  return base || "import.xlsx";
}

async function ensureImportTempDir() {
  await fs.mkdir(IMPORT_TMP_DIR, { recursive: true });
}

function getImportTempFilePath(batchId, filename) {
  const safeName = sanitizeImportFilename(filename);
  return path.join(IMPORT_TMP_DIR, `asset-import-${batchId}-${safeName}`);
}

async function saveImportTempFile(batchId, filename, buffer) {
  await ensureImportTempDir();
  const tempFilePath = getImportTempFilePath(batchId, filename);
  await fs.writeFile(tempFilePath, buffer);
  return tempFilePath;
}

async function readImportTempFile(tempFilePath) {
  return fs.readFile(tempFilePath);
}

function extractBatchState(batch) {
  const raw = batch?.errors;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      items: Array.isArray(raw) ? raw : [],
      metrics: {},
      meta: {},
    };
  }
  return {
    items: Array.isArray(raw.items) ? raw.items : [],
    metrics: raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {},
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
  };
}

function buildBatchErrorsPayload({ items, metrics, meta }) {
  return {
    items: Array.isArray(items) ? items.slice(0, 200) : [],
    metrics: metrics && typeof metrics === "object" ? metrics : {},
    meta: meta && typeof meta === "object" ? meta : {},
  };
}

function serializeBatch(batch) {
  const state = extractBatchState(batch);
  return {
    ...batch,
    errorItems: state.items,
    metrics: state.metrics,
    canResume:
      Boolean(state.meta?.tempFilePath) &&
      batch.status !== "COMPLETED" &&
      batch.status !== "PROCESSING",
    canRecoverErrors:
      Boolean(state.meta?.tempFilePath) &&
      batch.status === "COMPLETED" &&
      state.items.some((item) => item?.imported !== true),
  };
}

async function importAssetsFromExcel(buffer, user, filename = "import.xlsx", options = {}) {
  if (!canCreateAsset(user, user.establishmentId || 0) && user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("No autorizado para importacion masiva");
  }

  const resumeState = options.resumeState || {};
  const existingBatchId = Number(options.batchId);
  const batchId = Number.isInteger(existingBatchId) && existingBatchId > 0 ? existingBatchId : null;
  const tempFilePath = options.tempFilePath || resumeState?.meta?.tempFilePath || null;

  const batch =
    batchId ||
    (
      await prisma.assetImportBatch.create({
        data: {
          filename,
          status: "PROCESSING",
          userId: user.id,
          errors: buildBatchErrorsPayload({
            items: [],
            metrics: {
              processedRows: 0,
              totalRows: 0,
              fastPathRows: 0,
              standardRows: 0,
              fastPathAssets: 0,
              standardAssets: 0,
              totalMs: 0,
              chunkSize: IMPORT_CHUNK_SIZE,
              resumeRow: 1,
            },
            meta: tempFilePath ? { tempFilePath } : {},
          }),
        },
      })
    ).id;
  const importStartedAt = Number(resumeState?.metrics?.startedAtMs || Date.now());
  let errors = Array.isArray(resumeState.errorItems) ? [...resumeState.errorItems] : [];
  let createdCount = Number(resumeState.createdCount || 0);
  let metrics = {};
  let batchMeta =
    tempFilePath && !resumeState?.meta
      ? { tempFilePath }
      : resumeState?.meta && typeof resumeState.meta === "object"
        ? { ...resumeState.meta, ...(tempFilePath ? { tempFilePath } : {}) }
        : tempFilePath
          ? { tempFilePath }
          : {};

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw badRequest("Archivo Excel vacio");

    let headerRowNumber = 0;
    const maxHeaderSearchRow = Math.min(sheet.lastRow?.number || 1, 50);
    for (let rowNumber = 1; rowNumber <= maxHeaderSearchRow; rowNumber++) {
      const candidateKeys = [];
      sheet.getRow(rowNumber).eachCell((cell) => {
        const normalized = normalizeHeader(cell.value);
        candidateKeys.push(HEADER_ALIASES[normalized] || normalized);
      });
      const hasRequiredSignature =
        candidateKeys.includes("internalcode") &&
        candidateKeys.includes("name") &&
        candidateKeys.includes("quantity");
      if (hasRequiredSignature) {
        headerRowNumber = rowNumber;
        break;
      }
    }
    if (!headerRowNumber) {
      throw badRequest(
        "No se encontro una fila de encabezados con Codigo, Nombre y Cantidad",
        "IMPORT_SCHEMA"
      );
    }
    const dataStartRow = headerRowNumber + 1;
    let declaredRecordCount = null;
    let metadataEstablishmentName = null;
    for (let rowNumber = 1; rowNumber < headerRowNumber; rowNumber++) {
      sheet.getRow(rowNumber).eachCell((cell) => {
        const text = String(cell.value || "").trim();
        const match = text.match(/registros?\s*:?\s*(\d+)/i);
        if (match && !declaredRecordCount) declaredRecordCount = Number(match[1]);
        if (!metadataEstablishmentName) {
          const establishmentMatch = text.match(
            /((?:RESIDENCIA\s+FAMILIAR|UEFAA?)\s+[^|]+?)(?:\s*\|\s*Sector:|$)/i
          );
          if (establishmentMatch) {
            metadataEstablishmentName = establishmentMatch[1].trim();
          }
        }
      });
    }
    const dataEndRow = declaredRecordCount
      ? dataStartRow + declaredRecordCount - 1
      : null;
    const templateType = headerRowNumber === 1
      ? "LEGACY_ENCABEZADO_FILA_1"
      : "VAL_OFICIAL_ENCABEZADO_DETECTADO";
    const headerRow = sheet.getRow(headerRowNumber);
    const keyMap = {};
    const headersFound = [];

    headerRow.eachCell((cell, colNumber) => {
      const key = normalizeHeader(cell.value);
      if (key) {
        const canonical = HEADER_ALIASES[key] || key;
        keyMap[canonical] = colNumber;
        headersFound.push(canonical);
      }
    });

    const hasInstitutionIdColumn = Boolean(keyMap["institutionid"]);
    if (hasInstitutionIdColumn) {
      await prisma.assetImportBatch.update({
        where: { id: batch },
        data: {
          status: "FAILED",
          errorCount: 1,
          errors: {
            message: "institutionId no permitido en importacion",
            headersFound,
          },
          completedAt: new Date(),
        },
      });
      throw badRequest("institutionId no permitido en importacion", "IMPORT_SCHEMA", {
        headersFound,
      });
    }

    if (!headersFound.length) {
      await prisma.assetImportBatch.update({
        where: { id: batch },
        data: {
          status: "FAILED",
          errorCount: 1,
          errors: {
            message: "No se detectaron encabezados en el Excel",
          },
          completedAt: new Date(),
        },
      });
      throw badRequest("No se detectaron encabezados en el Excel", "IMPORT_SCHEMA");
    }

    errors = Array.isArray(resumeState.errorItems) ? [...resumeState.errorItems] : errors;
    createdCount = Number(resumeState.createdCount || createdCount || 0);
    const sheetLastRow = sheet.lastRow ? sheet.lastRow.number : 1;
    const lastRow = dataEndRow ? Math.min(sheetLastRow, dataEndRow) : sheetLastRow;
    const processableRows = countProcessableImportRows(
      sheet,
      keyMap,
      dataStartRow,
      dataEndRow
    );
    metrics = {
      processedRows: Number(resumeState?.metrics?.processedRows || 0),
      totalRows: Math.max(Number(resumeState?.metrics?.totalRows || 0), processableRows),
      fastPathRows: Number(resumeState?.metrics?.fastPathRows || 0),
      standardRows: Number(resumeState?.metrics?.standardRows || 0),
      fastPathAssets: Number(resumeState?.metrics?.fastPathAssets || 0),
      standardAssets: Number(resumeState?.metrics?.standardAssets || 0),
      totalMs: Number(resumeState?.metrics?.totalMs || 0),
      chunkSize: IMPORT_CHUNK_SIZE,
      resumeRow: Number(resumeState?.metrics?.resumeRow || 1),
      startedAtMs: importStartedAt,
      lastRow,
      headerRow: headerRowNumber,
      dataStartRow,
      dataEndRow: lastRow,
      declaredRecordCount,
      metadataEstablishmentName,
    };
    batchMeta = {
      ...batchMeta,
      templateType,
      headerRow: headerRowNumber,
      dataStartRow,
      dataEndRow: lastRow,
      declaredRecordCount,
      metadataEstablishmentName,
      ...(tempFilePath ? { tempFilePath } : {}),
    };
    async function persistBatchState(status = "PROCESSING") {
      const now = Date.now();
      metrics.totalMs = now - importStartedAt;
      const data = {
        status,
        createdCount,
        errorCount: errors.length,
        errors: buildBatchErrorsPayload({
          items: errors,
          metrics,
          meta: batchMeta,
        }),
      };
      if (status === "PROCESSING") {
        data.completedAt = null;
      } else {
        data.completedAt = new Date();
      }
      await prisma.assetImportBatch.update({
        where: { id: batch },
        data,
      });
    }
    const [allEstablishments, allDependencies, allStates, allTypes] = await Promise.all([
      prisma.establishment.findMany({
        where: { isActive: true },
        select: { id: true, name: true, institutionId: true, isActive: true },
      }),
      prisma.dependency.findMany({
        where: { isActive: true },
        select: { id: true, name: true, establishmentId: true, isActive: true },
      }),
      prisma.assetState.findMany({
        select: { id: true, name: true },
      }),
      prisma.assetType.findMany({
        select: { id: true, name: true },
      }),
    ]);
    const establishmentById = new Map(allEstablishments.map((item) => [item.id, item]));
    const firstEstablishmentByInstitutionId = new Map();
    for (const item of allEstablishments) {
      if (!firstEstablishmentByInstitutionId.has(item.institutionId)) {
        firstEstablishmentByInstitutionId.set(item.institutionId, item);
      }
    }
    const dependencyById = new Map(allDependencies.map((item) => [item.id, item]));
    const stateById = new Map(allStates.map((item) => [item.id, item]));
    const typeById = new Map(allTypes.map((item) => [item.id, item]));
    const establishmentByName = new Map();
    const establishmentRows = [];
    for (const item of allEstablishments) {
      const key = normalizeLookupValue(item.name);
      if (!key) continue;
      establishmentRows.push({ id: item.id, key, raw: item.name });
      if (!establishmentByName.has(key)) establishmentByName.set(key, []);
      establishmentByName.get(key).push(item);
    }
    const dependencyByName = new Map();
    const dependencyByEstablishmentAndName = new Map();
    const dependencyByEstablishmentNameAndName = new Map();
    const dependencyRows = [];
    const establishmentNameById = new Map(
      allEstablishments.map((item) => [item.id, normalizeLookupValue(item.name)])
    );
    for (const item of allDependencies) {
      const nameKey = normalizeLookupValue(item.name);
      if (!nameKey) continue;
      dependencyRows.push({
        id: item.id,
        establishmentId: item.establishmentId,
        key: nameKey,
        raw: item.name,
        establishmentNameKey: establishmentNameById.get(item.establishmentId) || "",
      });
      if (!dependencyByName.has(nameKey)) dependencyByName.set(nameKey, []);
      dependencyByName.get(nameKey).push(item);
      dependencyByEstablishmentAndName.set(`${item.establishmentId}:${nameKey}`, item.id);
      const estNameKey = establishmentNameById.get(item.establishmentId);
      if (estNameKey) {
        const pairKey = `${estNameKey}:${nameKey}`;
        if (!dependencyByEstablishmentNameAndName.has(pairKey)) {
          dependencyByEstablishmentNameAndName.set(pairKey, []);
        }
        dependencyByEstablishmentNameAndName.get(pairKey).push(item);
      }
    }
    const stateByName = new Map(
      allStates.map((item) => [normalizeLookupValue(item.name), item.id])
    );
    const typeByName = new Map(
      allTypes.map((item) => [normalizeLookupValue(item.name), item.id])
    );
    const firstDependencyByEstablishmentId = new Map();
    for (const item of allDependencies) {
      if (!firstDependencyByEstablishmentId.has(item.establishmentId)) {
        firstDependencyByEstablishmentId.set(item.establishmentId, item);
      }
    }
    const defaultState = stateById.get(stateByName.get("bueno")) || allStates[0] || null;
    const defaultType = typeById.get(typeByName.get("control")) || allTypes[0] || null;

    let defaultEstablishment = null;
    if (user.establishmentId) {
      defaultEstablishment = establishmentById.get(Number(user.establishmentId)) || null;
    }
    if (!defaultEstablishment && user.institutionId) {
      defaultEstablishment =
        firstEstablishmentByInstitutionId.get(Number(user.institutionId)) || null;
    }
    if (!defaultEstablishment) {
      defaultEstablishment = allEstablishments[0] || null;
    }

    let defaultDependency = defaultEstablishment
      ? firstDependencyByEstablishmentId.get(defaultEstablishment.id) || null
      : null;
    if (!defaultDependency) {
      defaultDependency = allDependencies[0] || null;
      if (defaultDependency) {
        defaultEstablishment =
          establishmentById.get(defaultDependency.establishmentId) || defaultEstablishment;
      }
    }

    const createdIdentityRows = new Map();
    let rowsSinceFlush = 0;
    const startRow = Math.max(dataStartRow, Number(options.resumeFromRow || dataStartRow));
    const importedCodeRows = new Map();
    const reportedErrorRows = new Set(
      errors.map((item) => Number(item?.row)).filter((row) => Number.isInteger(row))
    );
    const activeDepreciationPolicies = await prisma.depreciationPolicy.findMany({
      where: { status: "VIGENTE" },
      orderBy: [{ accountingAccount: "asc" }, { appliesFrom: "desc" }],
      select: {
        accountingAccount: true,
        category: true,
        subcategory: true,
        usefulLifeYears: true,
        appliesFrom: true,
        status: true,
      },
    });

    for (let rowIndex = startRow; rowIndex <= lastRow; rowIndex++) {
      const row = sheet.getRow(rowIndex);
      if (row.hidden) {
        metrics.resumeRow = rowIndex;
        continue;
      }
      const establishmentIdRaw = getRowValue(row, keyMap, "establishmentid");
      const dependencyIdRaw = getRowValue(row, keyMap, "dependencyid");
      const assetStateIdRaw = getRowValue(row, keyMap, "assetstateid");
      const assetTypeIdRaw = getRowValue(row, keyMap, "assettypeid");
      const depreciationAnnualRaw = getRowValue(row, keyMap, "depreciationannualvalue");
      const depreciationRateRaw = getRowValue(row, keyMap, "depreciationannualrate");
      const depreciationStartDateRaw = getRowValue(row, keyMap, "depreciationstartdate");
      const hasPercentInAnnualCell = hasPercentMarker(depreciationAnnualRaw);

      const importedCodeRaw = String(getRowValue(row, keyMap, "internalcode") || "")
        .replace(/^'+/, "")
        .trim()
        .toUpperCase();
      const importedCodeMatch = importedCodeRaw.match(/^VAL(\d{7})$/);
      const importedInternalCode = importedCodeMatch ? Number(importedCodeMatch[1]) : null;
      const input = {
        importedCodeRaw,
        importedInternalCode,
        establishmentId: parsePositiveInt(establishmentIdRaw),
        dependencyId: parsePositiveInt(dependencyIdRaw),
        assetStateId: parsePositiveInt(assetStateIdRaw),
        assetTypeId: parsePositiveInt(assetTypeIdRaw),
        establishmentName:
          getRowValue(row, keyMap, "establishmentname") || metadataEstablishmentName,
        dependencyName: getRowValue(row, keyMap, "dependencyname"),
        assetStateName: getRowValue(row, keyMap, "assetstatename"),
        assetTypeName: getRowValue(row, keyMap, "assettype"),
        name: normalizeOptionalImportValue(getRowValue(row, keyMap, "name")),
        accountingAccount: normalizeOptionalImportValue(
          getRowValue(row, keyMap, "accountingaccount")
        ),
        analyticCode: normalizeOptionalImportValue(getRowValue(row, keyMap, "analyticcode")),
        brand: normalizeOptionalImportValue(getRowValue(row, keyMap, "brand")),
        modelName: normalizeOptionalImportValue(getRowValue(row, keyMap, "modelname")),
        serialNumber: normalizeOptionalImportValue(getRowValue(row, keyMap, "serialnumber")),
        quantityRaw: getRowValue(row, keyMap, "quantity"),
        responsibleName: normalizeOptionalImportValue(getRowValue(row, keyMap, "responsiblename")),
        responsibleRut: normalizeImportRutValue(getRowValue(row, keyMap, "responsiblerut")),
        responsibleRole: normalizeOptionalImportValue(getRowValue(row, keyMap, "responsiblerole")),
        costCenter: normalizeOptionalImportValue(getRowValue(row, keyMap, "costcenter")),
        acquisitionValue: parseImportAcquisitionValue(getRowValue(row, keyMap, "acquisitionvalue")),
        acquisitionDate: parseImportAcquisitionDate(getRowValue(row, keyMap, "acquisitiondate")),
        depreciationStartDate: parseImportOptionalDate(depreciationStartDateRaw),
        usefulLifeYears: parseImportUsefulLifeYears(getRowValue(row, keyMap, "usefullifeyears")),
        depreciationAnnualValue: hasPercentInAnnualCell
          ? null
          : parseImportDepreciationAnnualValue(depreciationAnnualRaw),
        depreciationAnnualRate:
          parseImportDepreciationAnnualRate(depreciationRateRaw) ??
          (hasPercentInAnnualCell ? parseImportDepreciationAnnualRate(depreciationAnnualRaw) : null),
      };
      const quantityText = String(input.quantityRaw ?? "").trim();
      const quantity =
        !quantityText || quantityText.toLowerCase() === "null"
          ? 1
          : parsePositiveInt(input.quantityRaw);
      input.quantity = quantity;
      if (!input.establishmentName && input.costCenter) {
        const costCenterMatch = String(input.costCenter).match(/dependencia\s+(.+)$/i);
        const costCenterHint = normalizeLookupValue(costCenterMatch?.[1]);
        if (costCenterHint) {
          const matchedEstablishments = allEstablishments.filter((item) =>
            normalizeLookupValue(item.name).includes(costCenterHint)
          );
          if (matchedEstablishments.length === 1) {
            input.establishmentName = matchedEstablishments[0].name;
          }
        }
      }
      const normalizedResponsibleRut = input.responsibleRut || null;
      const normalizedCostCenter = normalizeCostCenter(input.costCenter);
      const estimatedUsefulLifeYears =
        input.usefulLifeYears ||
        resolveUsefulLifeYearsFromPolicies(activeDepreciationPolicies, {
          accountingAccount: input.accountingAccount,
          category: null,
          subcategory: null,
          acquisitionDate: input.acquisitionDate,
        }) ||
        estimateUsefulLifeYearsChile({
          name: input.name,
          accountingAccount: input.accountingAccount,
          assetTypeName: input.assetTypeName,
        });
      const depreciation = resolveDepreciationValues({
        acquisitionValue: input.acquisitionValue,
        usefulLifeYears: estimatedUsefulLifeYears,
        depreciationAnnualValue: input.depreciationAnnualValue,
        depreciationAnnualRate: input.depreciationAnnualRate,
      });
      const establishmentNameKey = normalizeLookupValue(input.establishmentName);
      const dependencyNameKey = normalizeLookupValue(input.dependencyName);
      const stateNameKey = normalizeLookupValue(input.assetStateName);
      const typeNameKey = normalizeLookupValue(input.assetTypeName);
      const rowHasData =
        Array.isArray(row.values) &&
        row.values.slice(1).some((value) => normalizeImportText(value) !== "");

      // Allow exported templates with summary rows like "TOTAL".
      const isSummaryRow =
        isSummaryImportName(input.name) || isSummaryImportName(input.importedCodeRaw);
      if (isSummaryRow) {
        metrics.resumeRow = rowIndex;
        continue;
      }
      if (!rowHasData) {
        metrics.resumeRow = rowIndex;
        continue;
      }
      metrics.processedRows += 1;

      if (!input.establishmentId && establishmentNameKey) {
        const matched = establishmentByName.get(establishmentNameKey) || [];
        if (matched.length === 1) {
          input.establishmentId = matched[0].id;
        } else if (matched.length === 0) {
          const fuzzy = establishmentRows.filter(
            (x) => x.key.includes(establishmentNameKey) || establishmentNameKey.includes(x.key)
          );
          if (fuzzy.length === 1) {
            input.establishmentId = fuzzy[0].id;
          }
        }
      }
      if (
        !input.establishmentId &&
        establishmentNameKey &&
        user.role?.type === "ADMIN_CENTRAL" &&
        user.institutionId
      ) {
        const estNameRaw = String(input.establishmentName || "").trim();
        if (estNameRaw) {
          let found = await prisma.establishment.findFirst({
            where: {
              institutionId: Number(user.institutionId),
              name: estNameRaw,
            },
            select: { id: true, isActive: true, name: true, institutionId: true },
          });
          if (!found) {
            found = await prisma.establishment.create({
              data: {
                name: estNameRaw,
                type: "IMPORTADO",
                institutionId: Number(user.institutionId),
                isActive: true,
              },
              select: { id: true, isActive: true, name: true, institutionId: true },
            });
          } else if (!found.isActive) {
            found = await prisma.establishment.update({
              where: { id: found.id },
              data: { isActive: true },
              select: { id: true, isActive: true, name: true, institutionId: true },
            });
          }
          input.establishmentId = found.id;
          establishmentById.set(found.id, found);
          const key = normalizeLookupValue(found.name);
          if (key) {
            if (!establishmentByName.has(key)) establishmentByName.set(key, []);
            establishmentByName.get(key).push(found);
            establishmentRows.push({ id: found.id, key, raw: found.name });
            establishmentNameById.set(found.id, key);
          }
        }
      }
      if (!input.assetStateId && stateNameKey) {
        input.assetStateId = stateByName.get(stateNameKey) || null;
      }
      if (!input.assetStateId && defaultState) {
        input.assetStateId = defaultState.id;
      }
      if (!input.assetTypeId && typeNameKey) {
        input.assetTypeId = typeByName.get(typeNameKey) || null;
      }
      if (!input.assetTypeId && defaultType) {
        input.assetTypeId = defaultType.id;
      }
      if (!input.establishmentId && defaultEstablishment) {
        input.establishmentId = defaultEstablishment.id;
      }
      if (!input.dependencyId && dependencyNameKey) {
        if (input.establishmentId) {
          input.dependencyId =
            dependencyByEstablishmentAndName.get(
              `${input.establishmentId}:${dependencyNameKey}`
            ) || null;
          if (!input.dependencyId) {
            const fuzzy = dependencyRows.filter(
              (x) =>
                x.establishmentId === input.establishmentId &&
                (x.key.includes(dependencyNameKey) || dependencyNameKey.includes(x.key))
            );
            if (fuzzy.length === 1) {
              input.dependencyId = fuzzy[0].id;
            }
          }
          if (
            !input.dependencyId &&
            user.role?.type === "ADMIN_CENTRAL" &&
            input.establishmentId
          ) {
            const depNameRaw = String(input.dependencyName || "").trim();
            if (depNameRaw) {
              let depFound = await prisma.dependency.findFirst({
                where: {
                  establishmentId: input.establishmentId,
                  name: depNameRaw,
                },
                select: { id: true, name: true, establishmentId: true, isActive: true },
              });
              if (!depFound) {
                depFound = await prisma.dependency.create({
                  data: {
                    name: depNameRaw,
                    establishmentId: input.establishmentId,
                    isActive: true,
                  },
                  select: { id: true, name: true, establishmentId: true, isActive: true },
                });
              } else if (!depFound.isActive) {
                depFound = await prisma.dependency.update({
                  where: { id: depFound.id },
                  data: { isActive: true },
                  select: { id: true, name: true, establishmentId: true, isActive: true },
                });
              }
              input.dependencyId = depFound.id;
              dependencyById.set(depFound.id, depFound);
              const depKey = normalizeLookupValue(depFound.name);
              if (depKey) {
                if (!dependencyByName.has(depKey)) dependencyByName.set(depKey, []);
                dependencyByName.get(depKey).push(depFound);
                dependencyByEstablishmentAndName.set(
                  `${depFound.establishmentId}:${depKey}`,
                  depFound.id
                );
                const estNameKey = establishmentNameById.get(depFound.establishmentId);
                if (estNameKey) {
                  const pairKey = `${estNameKey}:${depKey}`;
                  if (!dependencyByEstablishmentNameAndName.has(pairKey)) {
                    dependencyByEstablishmentNameAndName.set(pairKey, []);
                  }
                  dependencyByEstablishmentNameAndName.get(pairKey).push(depFound);
                }
                dependencyRows.push({
                  id: depFound.id,
                  establishmentId: depFound.establishmentId,
                  key: depKey,
                  raw: depFound.name,
                  establishmentNameKey:
                    establishmentNameById.get(depFound.establishmentId) || "",
                });
              }
            }
          }
        } else if (establishmentNameKey) {
          const byPair =
            dependencyByEstablishmentNameAndName.get(
              `${establishmentNameKey}:${dependencyNameKey}`
            ) || [];
          if (byPair.length === 1) {
            input.dependencyId = byPair[0].id;
            input.establishmentId = byPair[0].establishmentId;
          } else if (byPair.length === 0) {
            const fuzzy = dependencyRows.filter(
              (x) =>
                (x.establishmentNameKey.includes(establishmentNameKey) ||
                  establishmentNameKey.includes(x.establishmentNameKey)) &&
                (x.key.includes(dependencyNameKey) || dependencyNameKey.includes(x.key))
            );
            if (fuzzy.length === 1) {
              input.dependencyId = fuzzy[0].id;
              input.establishmentId = fuzzy[0].establishmentId;
            }
          }
        } else {
          const matched = dependencyByName.get(dependencyNameKey) || [];
          if (matched.length === 1) {
            input.dependencyId = matched[0].id;
            input.establishmentId = matched[0].establishmentId;
          }
        }
      }
      if (!input.dependencyId && input.establishmentId) {
        const fallbackDependency = firstDependencyByEstablishmentId.get(input.establishmentId);
        if (fallbackDependency) {
          input.dependencyId = fallbackDependency.id;
        }
      }
      if (!input.dependencyId && defaultDependency) {
        input.dependencyId = defaultDependency.id;
      }
      if (!input.establishmentId && input.dependencyId) {
        const dependency = dependencyById.get(input.dependencyId);
        if (dependency) {
          input.establishmentId = dependency.establishmentId;
        }
      }

      const invalidFields = [];
      if (templateType === "VAL_OFICIAL_FILA_13" && !input.importedInternalCode) {
        invalidFields.push("codigoMau");
      }
      if (input.importedInternalCode && input.quantity > 1) {
        invalidFields.push("quantity");
      }
      if (!input.name) invalidFields.push("name");
      if (!input.establishmentId) invalidFields.push("establishmentId");
      if (!input.dependencyId) invalidFields.push("dependencyId");
      if (!input.assetStateId) invalidFields.push("assetStateId");
      if (!input.assetTypeId) invalidFields.push("assetTypeId");
      if (validateAcquisitionValue(input.acquisitionValue)) {
        invalidFields.push("acquisitionValue");
      }
      if (validateAcquisitionDate(input.acquisitionDate)) {
        invalidFields.push("acquisitionDate");
      }
      if (normalizeImportText(depreciationStartDateRaw) && !input.depreciationStartDate) {
        invalidFields.push("depreciationStartDate");
      }
      if (
        input.depreciationStartDate &&
        validateDateNotFuture("depreciationStartDate", input.depreciationStartDate)
      ) {
        invalidFields.push("depreciationStartDate");
      }
      if (validateUsefulLifeYears(input.usefulLifeYears)) {
        invalidFields.push("usefulLifeYears");
      }
      if (validateDepreciationAnnualRate(input.depreciationAnnualRate)) {
        invalidFields.push("depreciationAnnualRate");
      }
      if (
        validateDepreciationAnnualValue(
          depreciation.depreciationAnnualValue,
          input.acquisitionValue
        )
      ) {
        invalidFields.push("depreciationAnnualValue");
      }
      if (validateStringMax("name", input.name, MAX_NAME_LENGTH)) {
        invalidFields.push("name");
      }
      if (validateStringMax("brand", input.brand, MAX_SHORT_TEXT)) {
        invalidFields.push("brand");
      }
      if (validateStringMax("modelName", input.modelName, MAX_SHORT_TEXT)) {
        invalidFields.push("modelName");
      }
      if (validateStringMax("serialNumber", input.serialNumber, MAX_SHORT_TEXT)) {
        invalidFields.push("serialNumber");
      }
      if (validateStringMax("accountingAccount", input.accountingAccount, MAX_SHORT_TEXT)) {
        invalidFields.push("accountingAccount");
      }
      if (validateStringMax("analyticCode", input.analyticCode, MAX_SHORT_TEXT)) {
        invalidFields.push("analyticCode");
      }
      if (validateStringMax("responsibleName", input.responsibleName, MAX_SHORT_TEXT)) {
        invalidFields.push("responsibleName");
      }
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        invalidFields.push("quantity");
      }
      if (input.quantity > 1 && input.serialNumber) {
        invalidFields.push("serialNumber");
      }
      if (validateStringMax("responsibleRole", input.responsibleRole, MAX_SHORT_TEXT)) {
        invalidFields.push("responsibleRole");
      }
      if (validateStringMax("costCenter", normalizedCostCenter, MAX_SHORT_TEXT)) {
        invalidFields.push("costCenter");
      }

      if (invalidFields.length) {
        errors.push({
          row: rowIndex,
          error: "Datos requeridos incompletos o invalidos",
          fields: invalidFields,
          values: {
            establishmentName: input.establishmentName || null,
            dependencyName: input.dependencyName || null,
            assetStateName: input.assetStateName || null,
            assetTypeName: input.assetTypeName || null,
          },
        });
        continue;
      }

      if (input.importedInternalCode) {
        const previousCodeRow = importedCodeRows.get(input.importedInternalCode);
        if (previousCodeRow) {
          errors.push({
            row: rowIndex,
            error: `Codigo VAL duplicado en el archivo; primera aparicion en fila ${previousCodeRow}`,
            fields: ["codigoMau"],
            values: { codigoMau: input.importedCodeRaw },
          });
          continue;
        }
        importedCodeRows.set(input.importedInternalCode, rowIndex);
      }

      try {
        enforceEstablishmentScope(user, input.establishmentId);
        if (!canCreateAsset(user, input.establishmentId)) {
          throw forbidden("No autorizado para este establecimiento");
        }
        const establishment = establishmentById.get(input.establishmentId);
        if (!establishment) throw notFound("Establishment no existe");
        if (!establishment.isActive) throw badRequest("Establishment inactivo");
        if (
          user.role.type === "ADMIN_ESTABLISHMENT" &&
          user.institutionId &&
          establishment.institutionId !== user.institutionId
        ) {
          throw forbidden("No autorizado para esta institution");
        }

        const dependency = dependencyById.get(input.dependencyId);
        if (!dependency) throw notFound("Sector no existe");
        if (!dependency.isActive) throw badRequest("Sector inactivo");
        if (dependency.establishmentId !== input.establishmentId) {
          throw badRequest("Sector no pertenece al establishment");
        }

        const state = stateById.get(input.assetStateId);
        if (!state) throw notFound("AssetState no existe");

        const assetType = typeById.get(input.assetTypeId);
        if (!assetType) throw notFound("AssetType no existe");

        const existingImportedAsset = input.importedInternalCode
          ? await prisma.asset.findUnique({
              where: { internalCode: input.importedInternalCode },
              select: { id: true, establishmentId: true },
            })
          : null;
        if (existingImportedAsset) {
          if (existingImportedAsset.establishmentId !== input.establishmentId) {
            throw badRequest(
              `Codigo VAL ${input.importedCodeRaw} ya existe en otro establecimiento`
            );
          }
          metrics.skippedExistingAssets = Number(metrics.skippedExistingAssets || 0) + 1;
          metrics.resumeRow = rowIndex;
          metrics.processedRows += 1;
          continue;
        }

        const identityKey = buildAssetIdentityKey(input);
        const previousCreatedRow = identityKey ? createdIdentityRows.get(identityKey) : null;
        if (previousCreatedRow && !input.importedInternalCode) {
          throw badRequest(
            `Duplicado en el mismo archivo: serie, marca y modelo ya importados en fila ${previousCreatedRow}`
          );
        }
        if (previousCreatedRow && input.importedInternalCode && !reportedErrorRows.has(rowIndex)) {
          errors.push({
            row: rowIndex,
            severity: "WARNING",
            imported: true,
            error: `Posible duplicado por serie, marca y modelo respecto de fila ${previousCreatedRow}; importado igualmente por tener VAL unico`,
            values: { codigoMau: input.importedCodeRaw, name: input.name || null },
          });
          reportedErrorRows.add(rowIndex);
        }
        const usedFastPath = !input.serialNumber && input.quantity > 1;

        const createdAssets = await prisma.$transaction(async (tx) => {
          if (!input.importedInternalCode) {
            await ensureUniqueAssetIdentity(tx, {
              serialNumber: input.serialNumber,
              brand: input.brand,
              modelName: input.modelName,
            });
          }

          const reservedCodes = input.importedInternalCode
            ? [input.importedInternalCode]
            : await reserveInternalCodes(tx, establishment.institutionId, input.quantity);
          const canUseBatchCreate = !input.serialNumber && input.quantity > 1;
          if (canUseBatchCreate) {
            await tx.asset.createMany({
              data: reservedCodes.map((internalCode) => ({
                internalCode,
                name: String(input.name),
                brand: input.brand ? String(input.brand) : null,
                modelName: input.modelName ? String(input.modelName) : null,
                serialNumber: null,
                quantity: 1,
                accountingAccount: input.accountingAccount
                  ? String(input.accountingAccount)
                  : null,
                analyticCode: input.analyticCode ? String(input.analyticCode) : null,
                responsibleName: input.responsibleName ? String(input.responsibleName) : null,
                responsibleRut: normalizedResponsibleRut || null,
                responsibleRole: input.responsibleRole ? String(input.responsibleRole) : null,
                costCenter: normalizedCostCenter,
                acquisitionValue: Number(input.acquisitionValue),
                acquisitionDate: new Date(input.acquisitionDate),
                depreciationStartDate:
                  input.depreciationStartDate || input.acquisitionDate || null,
                usefulLifeYears: depreciation.usefulLifeYears,
                depreciationAnnualValue: depreciation.depreciationAnnualValue,
                assetTypeId: assetType.id,
                assetStateId: state.id,
                establishmentId: establishment.id,
                dependencyId: dependency.id,
                importBatchId: batch,
              })),
            });

            const assetsInRow = await tx.asset.findMany({
              where: { internalCode: { in: reservedCodes } },
              orderBy: { internalCode: "asc" },
            });

            if (assetsInRow.length !== reservedCodes.length) {
              throw badRequest("No se pudo consolidar el lote de assets importados");
            }

            await tx.movement.createMany({
              data: assetsInRow.map((createdAsset) => ({
                type: "INVENTORY_CHECK",
                assetId: createdAsset.id,
                fromDependencyId: null,
                toDependencyId: dependency.id,
                userId: user.id,
              })),
            });

            return assetsInRow;
          }

          const assetsInRow = [];
          for (let unit = 0; unit < input.quantity; unit++) {
            let asset = null;
            let lastUniqueErr = null;
            let internalCode = reservedCodes[unit];
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const createdAsset = await tx.asset.create({
                  data: {
                    internalCode,
                    name: String(input.name),
                    brand: input.brand ? String(input.brand) : null,
                    modelName: input.modelName ? String(input.modelName) : null,
                    serialNumber: input.serialNumber ? String(input.serialNumber) : null,
                    quantity: 1,
                    accountingAccount: input.accountingAccount
                      ? String(input.accountingAccount)
                      : null,
                    analyticCode: input.analyticCode ? String(input.analyticCode) : null,
                    responsibleName: input.responsibleName
                      ? String(input.responsibleName)
                      : null,
                    responsibleRut: normalizedResponsibleRut || null,
                    responsibleRole: input.responsibleRole
                      ? String(input.responsibleRole)
                      : null,
                    costCenter: normalizedCostCenter,
                    acquisitionValue: Number(input.acquisitionValue),
                    acquisitionDate: new Date(input.acquisitionDate),
                    depreciationStartDate:
                      input.depreciationStartDate || input.acquisitionDate || null,
                    usefulLifeYears: depreciation.usefulLifeYears,
                    depreciationAnnualValue: depreciation.depreciationAnnualValue,
                    assetTypeId: assetType.id,
                    assetStateId: state.id,
                    establishmentId: establishment.id,
                    dependencyId: dependency.id,
                    importBatchId: batch,
                  },
                });

                asset = createdAsset;
                break;
              } catch (e) {
                if (isInternalCodeUniqueConstraintError(e)) {
                  if (input.importedInternalCode) {
                    throw badRequest(`Codigo VAL ${input.importedCodeRaw} ya existe en la base de datos`);
                  }
                  lastUniqueErr = e;
                  internalCode = (await reserveInternalCodes(tx, establishment.institutionId, 1))[0];
                  continue;
                }
                if (isPrismaUniqueConstraintError(e)) {
                  lastUniqueErr = e;
                  continue;
                }
                throw e;
              }
            }

            if (!asset && lastUniqueErr) {
              throw badRequest("Conflicto de codigo interno durante importacion");
            }
            if (!asset) {
              throw badRequest("No se pudo crear asset durante importacion");
            }
            assetsInRow.push(asset);
          }

          if (assetsInRow.length) {
            await tx.movement.createMany({
              data: assetsInRow.map((createdAsset) => ({
                type: "INVENTORY_CHECK",
                assetId: createdAsset.id,
                fromDependencyId: null,
                toDependencyId: dependency.id,
                userId: user.id,
              })),
            });
          }

          return assetsInRow;
        });

        createdCount += createdAssets.length;
        if (input.importedInternalCode && createdAssets.length) {
          const reportedIndex = errors.findIndex((item) => Number(item?.row) === rowIndex);
          if (reportedIndex >= 0) {
            errors[reportedIndex] = {
              ...errors[reportedIndex],
              severity: "WARNING",
              imported: true,
              error: `${errors[reportedIndex].error}; importado igualmente por tener VAL unico`,
              values: {
                ...(errors[reportedIndex].values || {}),
                codigoMau: input.importedCodeRaw,
              },
            };
          }
        }
        if (usedFastPath) {
          metrics.fastPathRows += 1;
          metrics.fastPathAssets += createdAssets.length;
        } else {
          metrics.standardRows += 1;
          metrics.standardAssets += createdAssets.length;
        }
        if (identityKey) {
          createdIdentityRows.set(identityKey, rowIndex);
        }
      } catch (e) {
        errors.push({
          row: rowIndex,
          error: e.message || "Error importando",
          values: {
            establishmentId: establishmentIdRaw || null,
            dependencyId: dependencyIdRaw || null,
            assetStateId: assetStateIdRaw || null,
            assetTypeId: assetTypeIdRaw || null,
            name: input.name || null,
          },
        });
      }
      metrics.resumeRow = rowIndex;
      rowsSinceFlush += 1;
      if (rowsSinceFlush >= IMPORT_PROGRESS_FLUSH_EVERY) {
        await persistBatchState("PROCESSING");
        rowsSinceFlush = 0;
      }
    }

    await persistBatchState("COMPLETED");
    return {
      batchId: batch,
      status: "COMPLETED",
      createdCount,
      errorCount: errors.length,
      errors,
      metrics,
    };
  } catch (err) {
    await prisma.assetImportBatch.update({
      where: { id: batch },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        createdCount,
        errorCount: errors.length + 1,
        errors: buildBatchErrorsPayload({
          items: [
            ...errors,
            {
              row: Number(metrics.resumeRow || 0) || null,
              error: err?.message || "Error",
              ...(err?.details ? { details: err.details } : {}),
            },
          ],
          metrics: {
            ...metrics,
            totalMs: Date.now() - importStartedAt,
          },
          meta: batchMeta,
        }),
      },
    });
    throw err;
  }
}

async function queueAssetImportJob(buffer, user, filename = "import.xlsx") {
  if (!canCreateAsset(user, user.establishmentId || 0) && user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("No autorizado para importacion masiva");
  }

  const batch = await prisma.assetImportBatch.create({
    data: {
      filename,
      status: "PROCESSING",
      userId: user.id,
    },
  });
  const tempFilePath = await saveImportTempFile(batch.id, filename, buffer);
  const seeded = await prisma.assetImportBatch.update({
    where: { id: batch.id },
    data: {
      errors: buildBatchErrorsPayload({
        items: [],
        metrics: {
          processedRows: 0,
          totalRows: 0,
          fastPathRows: 0,
          standardRows: 0,
          fastPathAssets: 0,
          standardAssets: 0,
          totalMs: 0,
          chunkSize: IMPORT_CHUNK_SIZE,
          resumeRow: 1,
          startedAtMs: Date.now(),
        },
        meta: {
          tempFilePath,
        },
      }),
    },
  });

  setImmediate(async () => {
    try {
      const fileBuffer = await readImportTempFile(tempFilePath);
      await importAssetsFromExcel(fileBuffer, user, filename, {
        batchId: batch.id,
        tempFilePath,
      });
    } catch (err) {
      try {
        const latest = await prisma.assetImportBatch.findUnique({ where: { id: batch.id } });
        if (latest?.status !== "FAILED") {
          const state = extractBatchState(latest);
          await prisma.assetImportBatch.update({
            where: { id: batch.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              errorCount: Math.max(latest?.errorCount || 0, state.items.length + 1),
              errors: buildBatchErrorsPayload({
                items: [
                  ...state.items,
                  {
                    row: Number(state.metrics?.resumeRow || 0) || null,
                    error: err?.message || "Error en job de importacion",
                  },
                ],
                metrics: {
                  ...state.metrics,
                  totalMs:
                    Number(state.metrics?.startedAtMs || Date.now()) > 0
                      ? Date.now() - Number(state.metrics?.startedAtMs || Date.now())
                      : Number(state.metrics?.totalMs || 0),
                },
                meta: state.meta,
              }),
            },
          });
        }
      } catch {
        // ignore background failure persistence errors
      }
    }
  });

  return serializeBatch(seeded);
}

async function getAssetImportJobStatus(batchId, user) {
  const batch = await prisma.assetImportBatch.findUnique({
    where: { id: Number(batchId) },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!batch) throw notFound("ImportJob no existe");
  if (user.role.type !== "ADMIN_CENTRAL" && batch.userId !== user.id) {
    throw forbidden("No autorizado para ver este job");
  }
  return serializeBatch(batch);
}

async function resumeAssetImportJob(batchId, user) {
  const batch = await prisma.assetImportBatch.findUnique({
    where: { id: Number(batchId) },
  });
  if (!batch) throw notFound("ImportJob no existe");
  if (user.role.type !== "ADMIN_CENTRAL" && batch.userId !== user.id) {
    throw forbidden("No autorizado para reanudar este job");
  }
  if (batch.status === "PROCESSING") {
    throw badRequest("El job ya esta en proceso");
  }

  const state = extractBatchState(batch);
  const tempFilePath = state.meta?.tempFilePath;
  if (!tempFilePath) {
    throw badRequest("No existe archivo temporal para reanudar");
  }

  const recoverCompletedErrors =
    batch.status === "COMPLETED" &&
    state.items.some((item) => item?.imported !== true);
  if (batch.status === "COMPLETED" && !recoverCompletedErrors) {
    throw badRequest("El lote ya fue completado sin errores recuperables");
  }
  const recoveryStartRow = Number(
    state.meta?.dataStartRow || state.metrics?.dataStartRow || 2
  );
  const resumeFromRow = recoverCompletedErrors
    ? Math.max(2, recoveryStartRow)
    : Math.max(2, Number(state.metrics?.resumeRow || 1) + 1);
  const recoveryMetrics = recoverCompletedErrors
    ? {
        ...state.metrics,
        processedRows: 0,
        totalRows: 0,
        totalMs: 0,
        resumeRow: resumeFromRow - 1,
        skippedExistingAssets: 0,
        startedAtMs: Date.now(),
      }
    : state.metrics;
  const restarted = await prisma.assetImportBatch.update({
    where: { id: batch.id },
    data: {
      status: "PROCESSING",
      completedAt: null,
      errors: buildBatchErrorsPayload({
        items: state.items,
        metrics: {
          ...recoveryMetrics,
          startedAtMs: Number(recoveryMetrics?.startedAtMs || Date.now()),
        },
        meta: state.meta,
      }),
    },
  });

  setImmediate(async () => {
    try {
      const fileBuffer = await readImportTempFile(tempFilePath);
      await importAssetsFromExcel(fileBuffer, user, batch.filename, {
        batchId: batch.id,
        tempFilePath,
        resumeFromRow,
        resumeState: {
          createdCount: batch.createdCount,
          errorItems: state.items,
          metrics: recoveryMetrics,
          meta: state.meta,
        },
      });
    } catch (err) {
      try {
        const latest = await prisma.assetImportBatch.findUnique({ where: { id: batch.id } });
        if (latest?.status !== "FAILED") {
          const latestState = extractBatchState(latest);
          await prisma.assetImportBatch.update({
            where: { id: batch.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              errorCount: Math.max(latest?.errorCount || 0, latestState.items.length + 1),
              errors: buildBatchErrorsPayload({
                items: [
                  ...latestState.items,
                  {
                    row: Number(latestState.metrics?.resumeRow || 0) || null,
                    error: err?.message || "Error reanudando importacion",
                  },
                ],
                metrics: {
                  ...latestState.metrics,
                  totalMs:
                    Number(latestState.metrics?.startedAtMs || Date.now()) > 0
                      ? Date.now() - Number(latestState.metrics?.startedAtMs || Date.now())
                      : Number(latestState.metrics?.totalMs || 0),
                },
                meta: latestState.meta,
              }),
            },
          });
        }
      } catch {
        // ignore background failure persistence errors
      }
    }
  });

  return serializeBatch(restarted);
}

async function buildAssetImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventario");
  sheet.addRow(["PLANTILLA OFICIAL DE INVENTARIO DE ACTIVOS FIJOS"]);
  sheet.mergeCells("A1:AH1");
  sheet.addRow(["Complete los metadatos y registre los bienes desde la fila 14."]);
  sheet.mergeCells("A2:AH2");
  sheet.addRow([]);
  sheet.addRow(["Encabezado:", ""]);
  sheet.addRow(["Rango:", ""]);
  sheet.addRow(["Encargado:", ""]);
  sheet.addRow(["Jefe:", ""]);
  sheet.addRow(["Fecha:", new Date()]);
  sheet.addRow(["Responsabilidad:", ""]);
  sheet.addRow([]);
  sheet.addRow(["Registros:", "", "Bienes:", "", "Valor adquisicion:", "", "Depreciacion anual:", ""]);
  sheet.addRow([]);
  sheet.addRow([
    "Codigo VAL", "Nombre", "Cantidad", "Numero Factura", "Numero Orden Compra",
    "Marca", "Modelo", "Serie", "Responsable", "RUT Responsable", "Cargo Responsable",
    "Centro de Costo", "Cuenta Contable", "Analitico", "Tipo", "Estado",
    "Establecimiento", "Sector", "Valor Adquisicion", "Fecha Adquisicion",
    "Fecha Inicio Depreciacion", "Depreciacion Anual CLP", "Tasa Depreciacion Anual",
    "Vida Util (anos)", "Proveedor Rut", "Proveedor Nombre", "OC Fecha", "Factura Fecha",
    "Guia", "Guia Fecha", "Folio Devengo", "Color", "Medidas", "Caracteristicas",
  ]);
  sheet.getRow(13).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(13).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
  sheet.views = [{ state: "frozen", ySplit: 13 }];
  sheet.autoFilter = { from: "A13", to: "AH13" };
  for (let column = 1; column <= 34; column++) {
    sheet.getColumn(column).width = column === 2 || column === 34 ? 32 : 18;
  }
  return workbook;
}

module.exports = {
  importAssetsFromExcel,
  queueAssetImportJob,
  getAssetImportJobStatus,
  resumeAssetImportJob,
  buildAssetImportTemplate,
};
