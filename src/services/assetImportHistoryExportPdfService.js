const PDFDocument = require("pdfkit");
const { listAssetImportBatches } = require("./assetImportHistoryService");

async function exportAssetImportHistoryToPdf(query, user) {
  const { items } = await listAssetImportBatches(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc.fontSize(14).text("HISTORIAL DE IMPORTACIONES", { align: "center" });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 90, 210, 300, 360, 420, 500];
  const headers = ["ID", "Archivo", "Estado", "Creados", "Errores", "Usuario", "Fecha"];

  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => {
    doc.text(t, colX[i], doc.y, { width: 70 });
  });
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((b) => {
    const y = doc.y;
    const row = [
      b.id,
      b.filename,
      b.status,
      b.createdCount,
      b.errorCount,
      b.user ? b.user.name : "",
      new Date(b.createdAt).toLocaleString(),
    ];

    row.forEach((v, i) => {
      doc.text(String(v), colX[i], y, { width: 70 });
    });
    doc.moveDown();
  });

  return doc;
}

module.exports = { exportAssetImportHistoryToPdf };
