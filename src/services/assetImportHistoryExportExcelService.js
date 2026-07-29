const ExcelJS = require("exceljs");
const { listAssetImportBatches } = require("./assetImportHistoryService");

async function exportAssetImportHistoryToExcel(query, user) {
  const { items } = await listAssetImportBatches(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Importaciones");

  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Archivo", key: "filename", width: 30 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Creados", key: "createdCount", width: 12 },
    { header: "Errores", key: "errorCount", width: 12 },
    { header: "Usuario", key: "user", width: 25 },
    { header: "Fecha", key: "createdAt", width: 22 },
  ];

  items.forEach((b) => {
    sheet.addRow({
      id: b.id,
      filename: b.filename,
      status: b.status,
      createdCount: b.createdCount,
      errorCount: b.errorCount,
      user: b.user ? `${b.user.name} (${b.user.email})` : "",
      createdAt: b.createdAt.toISOString(),
    });
  });

  sheet.getRow(1).font = { bold: true };
  return workbook;
}

module.exports = { exportAssetImportHistoryToExcel };
