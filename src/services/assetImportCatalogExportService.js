const ExcelJS = require("exceljs");
const { prisma } = require("../prisma");

async function buildAssetImportCatalogWorkbook() {
  const workbook = new ExcelJS.Workbook();

  const establishments = await prisma.establishment.findMany({
    select: { id: true, name: true, institutionId: true, isActive: true },
    orderBy: { name: "asc" },
  });

  const dependencies = await prisma.dependency.findMany({
    select: { id: true, name: true, establishmentId: true, isActive: true },
    orderBy: { name: "asc" },
  });

  const assetStates = await prisma.assetState.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const estSheet = workbook.addWorksheet("Establecimientos");
  estSheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nombre", key: "name", width: 40 },
    { header: "InstitutionId", key: "institutionId", width: 14 },
    { header: "Activo", key: "isActive", width: 10 },
  ];
  establishments.forEach((e) => estSheet.addRow(e));

  const depSheet = workbook.addWorksheet("Sectores");
  depSheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nombre", key: "name", width: 40 },
    { header: "EstablishmentId", key: "establishmentId", width: 16 },
    { header: "Activo", key: "isActive", width: 10 },
  ];
  dependencies.forEach((d) => depSheet.addRow(d));

  const stateSheet = workbook.addWorksheet("Estados");
  stateSheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nombre", key: "name", width: 20 },
  ];
  assetStates.forEach((s) => stateSheet.addRow(s));

  [estSheet, depSheet, stateSheet].forEach((sheet) => {
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
  });

  return workbook;
}

module.exports = { buildAssetImportCatalogWorkbook };
