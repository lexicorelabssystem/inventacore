const ExcelJS = require("exceljs");
const { prisma } = require("../prisma");
const { listAllAssetsForExport } = require("./assetQueryService");
const { formatAssetCode } = require("../utils/assetCode");

const PROCUREMENT_KEYS = [
  "proveedorRut",
  "proveedorNombre",
  "ordenCompra",
  "ocFecha",
  "factura",
  "facturaFecha",
  "guia",
  "guiaFecha",
  "folioDevengo",
];

const VISUAL_KEYS = ["serie", "color", "medidas", "caracteristicas"];

function toExcelDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date;
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function buildExternalCode(asset) {
  const fromVisible = formatAssetCode(asset?.visibleCode);
  if (fromVisible) return fromVisible;
  const fromInternal = formatAssetCode(asset?.internalCode);
  if (fromInternal) return fromInternal;
  const fallbackById = formatAssetCode(asset?.id);
  if (fallbackById) return fallbackById;
  return "";
}

function mapControlType(assetTypeName) {
  const normalized = String(assetTypeName || "").trim().toUpperCase();
  if (!normalized) return "";
  if (normalized.includes("CONTROL")) return "ADMINISTRATIVO";
  return "FINANCIERO";
}

function mapAssetStateFlag(asset) {
  if (asset?.isDeleted) return "BAJA";
  return "ALTA";
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSimilarityKey(asset) {
  const name = norm(asset?.name);
  const brand = norm(asset?.brand || asset?.catalogItem?.brand);
  const model = norm(asset?.modelName || asset?.catalogItem?.modelName);
  const desc = norm(asset?.catalogItem?.description);
  return [name, brand, model, desc].filter(Boolean).join(" ") || name || desc;
}

function readAssetValue(asset, keys) {
  for (const key of keys) {
    const value = asset?.[key];
    if (value === 0) return 0;
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function buildProcurementValues(asset) {
  return {
    proveedorRut: readAssetValue(asset, ["proveedorRut", "providerRut", "supplierRut", "supplierTaxId"]),
    proveedorNombre: readAssetValue(asset, [
      "proveedorNombre",
      "providerName",
      "supplierName",
      "supplier",
    ]),
    ordenCompra: readAssetValue(asset, ["ordenCompra", "purchaseOrder", "purchaseOrderNumber", "ocNumber"]),
    ocFecha: toExcelDate(readAssetValue(asset, ["ocFecha", "purchaseOrderDate", "ocDate"])),
    factura: readAssetValue(asset, ["factura", "invoiceNumber", "invoice"]),
    facturaFecha: toExcelDate(readAssetValue(asset, ["facturaFecha", "invoiceDate", "billDate"])),
    guia: readAssetValue(asset, ["guia", "guideNumber", "dispatchNote", "dispatchGuide"]),
    guiaFecha: toExcelDate(readAssetValue(asset, ["guiaFecha", "dispatchDate", "guideDate"])),
    folioDevengo: readAssetValue(asset, ["folioDevengo", "accrualFolio", "devengoFolio"]),
  };
}

function buildVisualValues(asset) {
  return {
    serie: readAssetValue(asset, ["serialNumber", "serie", "series"]),
    color: readAssetValue(asset, ["color", "colour"]),
    medidas: readAssetValue(asset, ["medidas", "dimensions", "size"]),
    caracteristicas: readAssetValue(asset, [
      "caracteristicas",
      "characteristics",
      "features",
      "description",
      "catalogDescription",
    ]),
  };
}

async function exportAssetsToNationalConsolidatedExcel(query, user) {
  const { items } = await listAllAssetsForExport(query, user);

  const institutionIds = [...new Set(
    items
      .map((asset) => Number(asset?.establishment?.institutionId || 0))
      .filter((id) => Number.isFinite(id) && id > 0)
  )];

  const institutions = institutionIds.length
    ? await prisma.institution.findMany({
        where: { id: { in: institutionIds } },
        select: { id: true, name: true },
      })
    : [];

  const institutionNameById = new Map(
    institutions.map((institution) => [institution.id, institution.name])
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventario Consolidado");

  sheet.columns = [
    { header: "Codigo", key: "codigo", width: 18 },
    { header: "Nombre del bien", key: "nombreBien", width: 34 },
    { header: "Establecimiento (Oficina, RF, etc)", key: "establecimiento", width: 38 },
    { header: "Piso", key: "piso", width: 10 },
    { header: "Ubicacion Nombre", key: "ubicacionNombre", width: 30 },
    { header: "Procedencia", key: "procedencia", width: 20 },
    {
      header: "Tipo control (Financiero = Depreciable, Administrativo=Registro)",
      key: "tipoControl",
      width: 35,
    },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Marca", key: "marca", width: 20 },
    { header: "Modelo", key: "modelo", width: 20 },
    { header: "Serie", key: "serie", width: 20 },
    { header: "Color", key: "color", width: 16 },
    { header: "Medidas", key: "medidas", width: 16 },
    { header: "Caracteristicas", key: "caracteristicas", width: 42 },
    { header: "Valor", key: "valor", width: 16 },
    { header: "Fecha Alta", key: "fechaAlta", width: 16 },
    { header: "Vida Util", key: "vidaUtil", width: 12 },
    { header: "Cuenta", key: "cuenta", width: 14 },
    { header: "Cuenta nombre", key: "cuentaNombre", width: 26 },
    { header: "Fecha Registro o ingreso base", key: "fechaRegistro", width: 24 },
    { header: "Proveedor Rut", key: "proveedorRut", width: 18 },
    { header: "Proveedor Nombre", key: "proveedorNombre", width: 28 },
    { header: "Orden compra", key: "ordenCompra", width: 22 },
    { header: "OC Fecha", key: "ocFecha", width: 14 },
    { header: "Factura", key: "factura", width: 16 },
    { header: "Factura Fecha", key: "facturaFecha", width: 16 },
    { header: "Guia", key: "guia", width: 16 },
    { header: "Guia Fecha", key: "guiaFecha", width: 16 },
    { header: "Folio devengo", key: "folioDevengo", width: 16 },
    { header: "Responsable Rut", key: "responsableRut", width: 18 },
    { header: "Responsable", key: "responsable", width: 28 },
    { header: "EstadoAF", key: "estadoAf", width: 14 },
    { header: "Comentarios", key: "comentarios", width: 32 },
    { header: "Usuario", key: "usuario", width: 24 },
    { header: "Patente", key: "patente", width: 16 },
    { header: "Rol", key: "rol", width: 16 },
    { header: "M2", key: "m2", width: 10 },
    { header: "Direccion", key: "direccion", width: 28 },
    { header: "Nombre", key: "nombre", width: 26 },
    { header: "Sector", key: "sector", width: 26 },
    { header: "Tipo construccion", key: "tipoConstruccion", width: 24 },
  ];

  const memoryBySector = new Map();
  const globalMemory = new Map();

  items.forEach((asset) => {
    const institutionName =
      institutionNameById.get(Number(asset?.establishment?.institutionId || 0)) || "";
    const catalogDescription = String(asset?.catalogItem?.description || "").trim();
    const visual = buildVisualValues(asset);
    const procurement = buildProcurementValues(asset);
    const sector = asset?.dependency?.name || "";
    const similarityKey = makeSimilarityKey(asset);

    const rowObj = {
      codigo: buildExternalCode(asset),
      nombreBien: asset.name || "",
      establecimiento: asset?.establishment?.name || "",
      piso: "",
      ubicacionNombre: sector,
      procedencia: "",
      tipoControl: mapControlType(asset?.assetType?.name),
      estado: asset?.assetState?.name || "",
      marca: asset.brand || asset?.catalogItem?.brand || "",
      modelo: asset.modelName || asset?.catalogItem?.modelName || "",
      serie: visual.serie || "",
      color: visual.color || "",
      medidas: visual.medidas || "",
      caracteristicas: visual.caracteristicas || "",
      valor: normalizeNumber(asset.acquisitionValue),
      fechaAlta: toExcelDate(asset.acquisitionDate),
      vidaUtil: normalizeNumber(asset.usefulLifeYears),
      cuenta: asset.accountingAccount || "",
      cuentaNombre: asset?.catalogItem?.category || "",
      fechaRegistro: toExcelDate(asset.createdAt),
      proveedorRut: procurement.proveedorRut || "",
      proveedorNombre: procurement.proveedorNombre || "",
      ordenCompra: procurement.ordenCompra || "",
      ocFecha: procurement.ocFecha || "",
      factura: procurement.factura || "",
      facturaFecha: procurement.facturaFecha || "",
      guia: procurement.guia || "",
      guiaFecha: procurement.guiaFecha || "",
      folioDevengo: procurement.folioDevengo || "",
      responsableRut: asset.responsibleRut || "",
      responsable: asset.responsibleName || "",
      estadoAf: mapAssetStateFlag(asset),
      comentarios: "",
      usuario: "",
      patente: "",
      rol: asset.responsibleRole || "",
      m2: "",
      direccion: "",
      nombre: institutionName,
      sector,
      tipoConstruccion: "",
    };

    if (!memoryBySector.has(sector)) memoryBySector.set(sector, new Map());
    const sectorMemory = memoryBySector.get(sector);
    const previousSector = sectorMemory.get(similarityKey);
    const previousGlobal = globalMemory.get(similarityKey);

    if (previousGlobal) {
      for (const key of [...PROCUREMENT_KEYS, ...VISUAL_KEYS]) {
        if (
          (rowObj[key] === "" || rowObj[key] === null || rowObj[key] === undefined) &&
          previousGlobal[key] !== "" &&
          previousGlobal[key] !== null &&
          previousGlobal[key] !== undefined
        ) {
          rowObj[key] = previousGlobal[key];
        }
      }
    }

    if (previousSector) {
      for (const key of [...PROCUREMENT_KEYS, ...VISUAL_KEYS]) {
        if (
          (rowObj[key] === "" || rowObj[key] === null || rowObj[key] === undefined) &&
          previousSector[key] !== "" &&
          previousSector[key] !== null &&
          previousSector[key] !== undefined
        ) {
          rowObj[key] = previousSector[key];
        }
      }
    }

    if (rowObj.caracteristicas === "") {
      rowObj.caracteristicas = catalogDescription;
    }

    sectorMemory.set(similarityKey, rowObj);
    globalMemory.set(similarityKey, rowObj);
    sheet.addRow(rowObj);
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  sheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 30 : 20;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFBFBF" } },
        left: { style: "thin", color: { argb: "FFBFBFBF" } },
        bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
        right: { style: "thin", color: { argb: "FFBFBFBF" } },
      };
    });
  });

  sheet.getColumn("valor").numFmt = "#,##0";
  sheet.getColumn("fechaAlta").numFmt = "yyyy-mm-dd";
  sheet.getColumn("fechaRegistro").numFmt = "yyyy-mm-dd";
  sheet.getColumn("ocFecha").numFmt = "yyyy-mm-dd";
  sheet.getColumn("facturaFecha").numFmt = "yyyy-mm-dd";
  sheet.getColumn("guiaFecha").numFmt = "yyyy-mm-dd";

  return workbook;
}

module.exports = { exportAssetsToNationalConsolidatedExcel };
