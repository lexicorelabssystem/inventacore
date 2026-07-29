const ExcelJS = require("exceljs");
const { getOfficialBrandLogoBuffer } = require("../utils/officialBranding");
const { formatAssetCode } = require("../utils/assetCode");

const COMPACT_TITLE = "SERVICIO DE PROTECCION ESPECIALIZADA A LA NINEZ Y ADOLESCENCIA";

function normalizeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed;
}

function readAssetValue(asset, keys) {
  for (const key of keys) {
    const value = asset?.[key];
    if (value === 0) return 0;
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function getInvoiceNumber(asset) {
  return readAssetValue(asset, ["factura", "invoiceNumber", "invoice"]);
}

function getPurchaseOrderNumber(asset) {
  return readAssetValue(asset, ["ordenCompra", "purchaseOrder", "purchaseOrderNumber", "ocNumber"]);
}

function getProcurementProviderRut(asset) {
  return readAssetValue(asset, ["proveedorRut", "providerRut", "supplierRut", "supplierTaxId"]);
}

function getProcurementProviderName(asset) {
  return readAssetValue(asset, ["proveedorNombre", "providerName", "supplierName", "supplier"]);
}

function getPurchaseOrderDate(asset) {
  return readAssetValue(asset, ["ocFecha", "purchaseOrderDate", "ocDate"]);
}

function getInvoiceDate(asset) {
  return readAssetValue(asset, ["facturaFecha", "invoiceDate", "billDate"]);
}

function getGuideNumber(asset) {
  return readAssetValue(asset, ["guia", "guideNumber", "dispatchNote", "dispatchGuide"]);
}

function getGuideDate(asset) {
  return readAssetValue(asset, ["guiaFecha", "dispatchDate", "guideDate"]);
}

function getAccrualFolio(asset) {
  return readAssetValue(asset, ["folioDevengo", "accrualFolio", "devengoFolio"]);
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "$0";
  return `$${Math.round(amount).toLocaleString("es-CL")}`;
}

function summarizeAssets(assets) {
  const items = Array.isArray(assets) ? assets : [];
  return items.reduce(
    (acc, item) => {
      acc.totalAssets += 1;
      acc.totalUnits += Math.max(Number(item?.quantity) || 0, 1);
      acc.totalValue += Math.max(Number(item?.acquisitionValue) || 0, 0);
      acc.totalAnnualDepreciation += Math.max(Number(item?.depreciationAnnualValue) || 0, 0);
      return acc;
    },
    { totalAssets: 0, totalUnits: 0, totalValue: 0, totalAnnualDepreciation: 0 }
  );
}

function paintHeader(row, color) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD5DDE5" } },
      left: { style: "thin", color: { argb: "FFD5DDE5" } },
      bottom: { style: "thin", color: { argb: "FFD5DDE5" } },
      right: { style: "thin", color: { argb: "FFD5DDE5" } },
    };
  });
}

function paintBodyRow(row, fillColor) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (fillColor) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    }
  });
}

async function buildPlanchetaCompactExcel(assets, meta) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Servicio Ninez");
  const normalizedAssets = Array.isArray(assets) ? assets : [];
  const summary = summarizeAssets(normalizedAssets);

  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.15,
      footer: 0.15,
    },
  };

  const logo = getOfficialBrandLogoBuffer();
  if (logo) {
    try {
      const imageId = workbook.addImage({ buffer: logo, extension: "png" });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 110, height: 50 },
      });
    } catch {
      // ignore logo errors
    }
  }

  sheet.columns = [
    { width: 16 }, // Codigo VAL
    { width: 30 }, // Nombre
    { width: 12 }, // Cantidad
    { width: 18 }, // Numero Factura
    { width: 20 }, // Numero Orden Compra
    { width: 16 }, // Marca
    { width: 16 }, // Modelo
    { width: 18 }, // Serie
    { width: 24 }, // Responsable
    { width: 18 }, // RUT Responsable
    { width: 22 }, // Cargo Responsable
    { width: 18 }, // Centro de Costo
    { width: 18 }, // Cuenta Contable
    { width: 16 }, // Analitico
    { width: 14 }, // Tipo
    { width: 14 }, // Estado
    { width: 24 }, // Establecimiento
    { width: 20 }, // Sector
    { width: 18 }, // Valor Adquisicion
    { width: 16 }, // Fecha Adquisicion
    { width: 20 }, // Fecha Inicio Depreciacion
    { width: 20 }, // Depreciacion Anual CLP
    { width: 20 }, // Tasa Depreciacion Anual
    { width: 14 }, // Vida Util (años)
    { width: 18 }, // Proveedor Rut
    { width: 26 }, // Proveedor Nombre
    { width: 16 }, // OC Fecha
    { width: 16 }, // Factura Fecha
    { width: 16 }, // Guia
    { width: 16 }, // Guia Fecha
    { width: 16 }, // Folio Devengo
    { width: 14 }, // Color
    { width: 16 }, // Medidas
    { width: 30 }, // Caracteristicas
  ];

  sheet.mergeCells("A1:AH1");
  sheet.getCell("A1").value = COMPACT_TITLE;
  sheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B4332" },
  };

  sheet.mergeCells("A2:AH2");
  sheet.getCell("A2").value =
    "Formato Servicio Ninez con campos de Activos Fijos y formula de depreciacion.";
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF475569" } };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.addRow([]);
  sheet.addRow([
    "Encabezado:",
    `${meta.institution || ""} | ${meta.establishment || ""} | Sector: ${meta.dependency || "Todos"}`,
  ]);
  sheet.addRow([
    "Rango:",
    `${meta.dateRange || "Sin filtro"} | ${
      meta.ministryText || "Resumen institucional de bienes verificados."
    }`,
  ]);
  sheet.addRow(["Encargado:", meta.responsibleName || "Encargado de Sector"]);
  sheet.addRow(["Jefe:", meta.chiefName || "Jefe de Sector"]);
  sheet.addRow(["Fecha:", new Date().toLocaleDateString("es-CL")]);
  const responsibilityRow = sheet.addRow([
    "Responsabilidad:",
    "El funcionario responsable debe velar por el buen uso, custodia y resguardo de los recursos asignados.",
  ]);
  sheet.mergeCells(`B${responsibilityRow.number}:AH${responsibilityRow.number}`);
  sheet.getCell(`A${responsibilityRow.number}`).font = {
    bold: true,
    color: { argb: "FF1B4332" },
  };
  sheet.getCell(`A${responsibilityRow.number}`).alignment = { vertical: "middle" };
  sheet.getCell(`B${responsibilityRow.number}`).font = {
    italic: true,
    color: { argb: "FF475569" },
  };
  sheet.getCell(`B${responsibilityRow.number}`).alignment = {
    vertical: "middle",
    wrapText: true,
  };

  sheet.addRow([]);
  const metrics = sheet.addRow([
    `Registros: ${summary.totalAssets}`,
    `Bienes: ${summary.totalUnits}`,
    `Valor adq: ${formatCurrency(summary.totalValue)}`,
    `Deprec anual: ${formatCurrency(summary.totalAnnualDepreciation)}`,
  ]);
  metrics.font = { bold: true };
  for (let i = 1; i <= 4; i += 1) {
    const cell = metrics.getCell(i);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9DBA9D" } },
      left: { style: "thin", color: { argb: "FF9DBA9D" } },
      bottom: { style: "thin", color: { argb: "FF9DBA9D" } },
      right: { style: "thin", color: { argb: "FF9DBA9D" } },
    };
  }

  sheet.addRow([]);
  const header = sheet.addRow([
    "Codigo VAL",
    "Nombre",
    "Cantidad",
    "Numero Factura",
    "Numero Orden Compra",
    "Marca",
    "Modelo",
    "Serie",
    "Responsable",
    "RUT Responsable",
    "Cargo Responsable",
    "Centro de Costo",
    "Cuenta Contable",
    "Analitico",
    "Tipo",
    "Estado",
    "Establecimiento",
    "Sector",
    "Valor Adquisicion",
    "Fecha Adquisicion",
    "Fecha Inicio Depreciacion",
    "Depreciacion Anual CLP",
    "Tasa Depreciacion Anual",
    "Vida Util (años)",
    "Proveedor Rut",
    "Proveedor Nombre",
    "OC Fecha",
    "Factura Fecha",
    "Guia",
    "Guia Fecha",
    "Folio Devengo",
    "Color",
    "Medidas",
    "Caracteristicas",
  ]);
  paintHeader(header, "FF475569");

  const dataStartRow = header.number + 1;
  normalizedAssets.forEach((asset, idx) => {
    const acquisitionValue = toNumber(asset.acquisitionValue);
    const annualRate =
      toNumber(asset.depreciationAnnualRate) ||
      (toNumber(asset.usefulLifeYears) > 0
        ? Number((100 / toNumber(asset.usefulLifeYears)).toFixed(4))
        : null);
    const annualDepreciationResult =
      toNumber(asset.depreciationAnnualValue) ||
      (acquisitionValue !== null && annualRate !== null
        ? Number(((acquisitionValue * annualRate) / 100).toFixed(2))
        : 0);
    const usefulLifeResult =
      toNumber(asset.usefulLifeYears) ||
      (annualRate !== null && annualRate > 0 ? Number((100 / annualRate).toFixed(2)) : 0);

    const row = sheet.addRow([
      formatAssetCode(asset.visibleCode || asset.internalCode),
      normalizeText(asset.name, ""),
      Math.max(Number(asset.quantity) || 0, 1),
      normalizeText(getInvoiceNumber(asset), ""),
      normalizeText(getPurchaseOrderNumber(asset), ""),
      normalizeText(asset.brand, ""),
      normalizeText(asset.modelName, ""),
      normalizeText(asset.serialNumber, ""),
      normalizeText(asset.responsibleName, ""),
      normalizeText(asset.responsibleRut, ""),
      normalizeText(asset.responsibleRole, ""),
      normalizeText(asset.costCenter, ""),
      normalizeText(asset.accountingAccount, ""),
      normalizeText(asset.analyticCode, ""),
      normalizeText(asset.assetType?.name, ""),
      normalizeText(asset.assetState?.name, ""),
      normalizeText(asset.establishment?.name, ""),
      normalizeText(asset.dependency?.name, ""),
      acquisitionValue,
      toDate(asset.acquisitionDate),
      toDate(asset.depreciationStartDate || asset.acquisitionDate),
      null,
      annualRate,
      null,
      normalizeText(getProcurementProviderRut(asset), ""),
      normalizeText(getProcurementProviderName(asset), ""),
      toDate(getPurchaseOrderDate(asset)),
      toDate(getInvoiceDate(asset)),
      normalizeText(getGuideNumber(asset), ""),
      toDate(getGuideDate(asset)),
      normalizeText(getAccrualFolio(asset), ""),
      normalizeText(readAssetValue(asset, ["color", "colour"]), ""),
      normalizeText(readAssetValue(asset, ["medidas", "dimensions", "size"]), ""),
      normalizeText(
        readAssetValue(asset, [
          "caracteristicas",
          "characteristics",
          "features",
          "description",
          "catalogDescription",
        ]),
        ""
      ),
    ]);

    const rowNumber = row.number;
    const annualDepreciationCell = row.getCell(23);
    annualDepreciationCell.value = {
      formula: `IF(OR(T${rowNumber}="",X${rowNumber}=""),"",ROUND(T${rowNumber}*X${rowNumber}/100,2))`,
      result: annualDepreciationResult,
    };

    const usefulLifeCell = row.getCell(25);
    usefulLifeCell.value = {
      formula: `IF(OR(X${rowNumber}="",X${rowNumber}=0),"",ROUND(100/X${rowNumber},2))`,
      result: usefulLifeResult,
    };

    row.height = 20;
    paintBodyRow(row, idx % 2 === 0 ? "FFF8FBF8" : null);
  });

  const dataEndRow = sheet.lastRow.number;
  const hasDataRows = normalizedAssets.length > 0;
  const totals = new Array(35).fill("");
  totals[0] = "TOTAL";
  totals[19] = hasDataRows ? { formula: `SUM(T${dataStartRow}:T${dataEndRow})` } : 0;
  totals[22] = hasDataRows ? { formula: `SUM(W${dataStartRow}:W${dataEndRow})` } : 0;
  const totalsRow = sheet.addRow(totals);
  totalsRow.font = { bold: true };
  paintBodyRow(totalsRow, "FFE8F5E9");

  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: 35 },
  };

  sheet.getColumn(20).numFmt = "#,##0";
  sheet.getColumn(21).numFmt = "yyyy-mm-dd";
  sheet.getColumn(22).numFmt = "yyyy-mm-dd";
  sheet.getColumn(23).numFmt = "#,##0.00";
  sheet.getColumn(24).numFmt = "0.0000";
  sheet.getColumn(25).numFmt = "0.00";
  sheet.getColumn(28).numFmt = "yyyy-mm-dd";
  sheet.getColumn(29).numFmt = "yyyy-mm-dd";
  sheet.getColumn(31).numFmt = "yyyy-mm-dd";

  sheet.getColumn(4).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getColumn(20).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getColumn(23).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getColumn(24).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getColumn(25).alignment = { horizontal: "right", vertical: "middle" };

  sheet.views = [{ state: "frozen", ySplit: header.number }];
  return workbook;
}

module.exports = { buildPlanchetaCompactExcel };
