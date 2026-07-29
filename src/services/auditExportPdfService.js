const PDFDocument = require("pdfkit");
const { getAuditLog } = require("./auditService");

async function exportAuditToPdf(query, user) {
  const { items } = await getAuditLog(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc
    .fontSize(14)
    .text("REPORTE DE AUDITORIA", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 120, 190, 280, 380, 470];
  const headers = ["Fecha", "Tipo", "Codigo", "Asset", "Usuario", "Hacia"];

  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => {
    doc.text(t, colX[i], doc.y, { width: 80 });
  });
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((m) => {
    const y = doc.y;
    const row = [
      m.createdAt.toISOString().slice(0, 10),
      m.type,
      m.asset?.internalCode || "",
      m.asset?.name || "",
      m.user?.name || "",
      m.toDependency?.name || "",
    ];

    row.forEach((v, i) => {
      doc.text(String(v), colX[i], y, { width: 80 });
    });
    doc.moveDown();
  });

  return doc;
}

module.exports = { exportAuditToPdf };
