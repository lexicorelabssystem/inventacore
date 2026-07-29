const PDFDocument = require("pdfkit");
const { listAdminAudits } = require("./adminAuditService");

async function exportAdminAuditToPdf(query, user) {
  const { items } = await listAdminAudits(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc
    .fontSize(14)
    .text("REPORTE AUDITORIA ADMIN", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 130, 220, 300, 380, 470];
  const headers = ["Fecha", "Entidad", "Accion", "ID", "Usuario", "Email"];

  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => {
    doc.text(t, colX[i], doc.y, { width: 80 });
  });
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((a) => {
    const y = doc.y;
    const row = [
      a.createdAt.toISOString().slice(0, 10),
      a.entityType,
      a.action,
      a.entityId,
      a.user?.name || "",
      a.user?.email || "",
    ];

    row.forEach((v, i) => {
      doc.text(String(v), colX[i], y, { width: 80 });
    });
    doc.moveDown();
  });

  return doc;
}

module.exports = { exportAdminAuditToPdf };
