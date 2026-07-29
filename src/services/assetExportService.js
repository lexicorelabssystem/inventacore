// src/services/assetExportService.js
const ExcelJS = require("exceljs");
const { listAllAssetsForExport } = require("./assetQueryService");
const { formatAssetCode } = require("../utils/assetCode");

async function exportAssetsToExcel(query, user) {
  const { items } = await listAllAssetsForExport(query, user);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventario");

  sheet.columns = [
    { header: "Codigo VAL", key: "visibleCode", width: 16 },
    { header: "Codigo Interno", key: "internalCode", width: 15 },
    { header: "Nombre", key: "name", width: 30 },
    { header: "Cantidad", key: "quantity", width: 12 },
    { header: "Marca", key: "brand", width: 20 },
    { header: "Modelo", key: "modelName", width: 20 },
    { header: "Serie", key: "serialNumber", width: 20 },
    { header: "Responsable", key: "responsibleName", width: 24 },
    { header: "RUT Responsable", key: "responsibleRut", width: 18 },
    { header: "Cargo Responsable", key: "responsibleRole", width: 24 },
    { header: "Centro de Costo", key: "costCenter", width: 20 },
    { header: "Cuenta Contable", key: "accountingAccount", width: 20 },
    { header: "Analitico", key: "analyticCode", width: 20 },
    { header: "Tipo", key: "assetType", width: 15 },
    { header: "Estado", key: "assetState", width: 15 },
    { header: "Establecimiento", key: "establishment", width: 35 },
    { header: "Sector", key: "dependency", width: 25 },
    { header: "Valor Adquisicion", key: "acquisitionValue", width: 20 },
    { header: "Fecha Adquisicion", key: "acquisitionDate", width: 20 },
    { header: "Fecha Inicio Depreciacion", key: "depreciationStartDate", width: 22 },
    { header: "Depreciacion Anual CLP", key: "depreciationAnnualValue", width: 22 },
    { header: "Tasa Depreciacion Anual (%)", key: "depreciationAnnualRate", width: 24 },
    { header: "Vida Util (años)", key: "usefulLifeYears", width: 18 },
  ];

  const dataStartRow = 2;
  items.forEach((a) => {
    sheet.addRow({
      visibleCode: formatAssetCode(a.visibleCode || a.internalCode),
      internalCode: a.internalCode,
      name: a.name,
      quantity: a.quantity ?? 1,
      brand: a.brand || "",
      modelName: a.modelName || "",
      serialNumber: a.serialNumber || "",
      responsibleName: a.responsibleName || "",
      responsibleRut: a.responsibleRut || "",
      responsibleRole: a.responsibleRole || "",
      costCenter: a.costCenter || "",
      accountingAccount: a.accountingAccount || "",
      analyticCode: a.analyticCode || "",
      assetType: a.assetType?.name || "",
      assetState: a.assetState?.name || "",
      establishment: a.establishment?.name || "",
      dependency: a.dependency?.name || "",
      acquisitionValue: a.acquisitionValue,
      acquisitionDate: new Date(a.acquisitionDate).toISOString().split("T")[0],
      depreciationStartDate: a.depreciationStartDate
        ? new Date(a.depreciationStartDate).toISOString().split("T")[0]
        : "",
      depreciationAnnualValue: a.depreciationAnnualValue ?? "",
      depreciationAnnualRate:
        a.depreciationAnnualValue && a.acquisitionValue
          ? Number(((a.depreciationAnnualValue / a.acquisitionValue) * 100).toFixed(4))
          : "",
      usefulLifeYears: a.usefulLifeYears ?? "",
    });
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  sheet.columns.forEach((col) => {
    col.alignment = { vertical: "middle", wrapText: true };
    col.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  });

  sheet.getColumn("acquisitionValue").numFmt = "#,##0";
  sheet.getColumn("acquisitionDate").numFmt = "yyyy-mm-dd";
  sheet.getColumn("depreciationStartDate").numFmt = "yyyy-mm-dd";
  sheet.getColumn("depreciationAnnualValue").numFmt = "#,##0.00";
  sheet.getColumn("depreciationAnnualRate").numFmt = "0.0000";

  const zebraFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF7F9FC" },
  };
  const criticalFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE5E5" },
  };
  const criticalFont = { color: { argb: "FFB00020" }, bold: true };

  const stateColumnIndex = sheet.getColumn("assetState").number;

  for (let rowIndex = dataStartRow; rowIndex <= sheet.lastRow.number; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    if (rowIndex % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = zebraFill;
      });
    }

    const stateCell = row.getCell(stateColumnIndex);
    const stateValue = String(stateCell.value || "").toUpperCase();
    if (
      stateValue.includes("BAJA") ||
      stateValue.includes("MALO") ||
      stateValue.includes("CRIT")
    ) {
      stateCell.fill = criticalFill;
      stateCell.font = criticalFont;
    }
  }

  const totalRow = sheet.addRow({
    name: "TOTAL",
    acquisitionValue: items.reduce((sum, a) => sum + (a.acquisitionValue || 0), 0),
  });
  totalRow.font = { bold: true };

  return workbook;
}

module.exports = { exportAssetsToExcel };
