const ExcelJS = require("exceljs");

function normLabel(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function summarizeAssets(assets) {
  const items = Array.isArray(assets) ? assets : [];
  const totalAssets = items.length;
  const totalUnits = items.reduce((acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1), 0);
  const totalValue = items.reduce(
    (acc, item) => acc + Math.max(Number(item?.acquisitionValue) || 0, 0),
    0
  );
  const totalAnnualDepreciation = items.reduce(
    (acc, item) => acc + Math.max(Number(item?.depreciationAnnualValue) || 0, 0),
    0
  );

  const aggregate = (picker, fallback) =>
    Array.from(
      items.reduce((map, item) => {
        const key = normLabel(picker(item), fallback);
        const units = Math.max(Number(item?.quantity) || 0, 1);
        map.set(key, (map.get(key) || 0) + units);
        return map;
      }, new Map())
    ).sort((a, b) => b[1] - a[1]);

  return {
    totalAssets,
    totalUnits,
    totalValue,
    totalAnnualDepreciation,
    states: aggregate((item) => item?.assetState?.name, "Sin estado"),
    dependencies: aggregate((item) => item?.dependency?.name, "Sin sector"),
    types: aggregate((item) => item?.assetType?.name, "Sin tipo"),
    brands: aggregate((item) => item?.brand, "Sin marca"),
    responsibles: aggregate((item) => item?.responsibleName, "Sin responsable"),
  };
}

function paintHeader(row, color) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD5DDE5" } },
      left: { style: "thin", color: { argb: "FFD5DDE5" } },
      bottom: { style: "thin", color: { argb: "FFD5DDE5" } },
      right: { style: "thin", color: { argb: "FFD5DDE5" } },
    };
  });
}

function addRankingSection(sheet, title, rows, totalUnits, color) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([title, "Cantidad", "Porcentaje"]);
  paintHeader(titleRow, color);
  rows.slice(0, 8).forEach(([label, count], idx) => {
    const pct = totalUnits > 0 ? count / totalUnits : 0;
    const row = sheet.addRow([label, count, pct]);
    row.getCell(3).numFmt = "0.0%";
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (idx % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });
  });
}

async function buildPlanchetaExecutiveExcel(assets, meta) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plancheta Gerencial");
  const summary = summarizeAssets(assets);

  sheet.columns = [
    { width: 34 },
    { width: 16 },
    { width: 16 },
    { width: 20 },
  ];

  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = "PLANCHETA GERENCIAL";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

  sheet.addRow([]);
  sheet.addRow([
    "Encabezado",
    `${meta.institution || ""} | ${meta.establishment || ""} | Sector: ${meta.dependency || "Todos"}`,
  ]);
  sheet.addRow([
    "Rango",
    `${meta.dateRange || "Sin filtro"} | ${
      meta.ministryText || "Resumen de bienes verificados en el sector indicado."
    }`,
  ]);
  sheet.addRow(["Fecha", new Date().toLocaleDateString("es-CL")]);

  sheet.addRow([]);
  const metrics = sheet.addRow([
    `Registros: ${summary.totalAssets}`,
    `Bienes: ${summary.totalUnits}`,
    `Valor: $${Math.round(summary.totalValue).toLocaleString("es-CL")}`,
    `Deprec anual: $${Math.round(summary.totalAnnualDepreciation).toLocaleString("es-CL")}`,
  ]);
  metrics.font = { bold: true };
  metrics.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  addRankingSection(sheet, "Estados", summary.states, summary.totalUnits, "FF2D6A4F");
  addRankingSection(sheet, "Sectores", summary.dependencies, summary.totalUnits, "FF1D4ED8");
  addRankingSection(sheet, "Tipos de Activo", summary.types, summary.totalUnits, "FF475569");
  addRankingSection(sheet, "Marcas", summary.brands, summary.totalUnits, "FF6B705C");
  addRankingSection(sheet, "Responsables", summary.responsibles, summary.totalUnits, "FF5A189A");

  return workbook;
}

module.exports = { buildPlanchetaExecutiveExcel };
