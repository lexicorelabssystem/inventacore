const PDFDocument = require("pdfkit");
const { listLoginAudits } = require("./loginAuditQueryService");

async function exportLoginAuditToPdf(query, user) {
  const { items } = await listLoginAudits(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc
    .fontSize(14)
    .text("REPORTE LOGIN AUDIT", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 140, 260, 360, 460];
  const headers = ["Fecha", "Email", "Usuario", "IP", "Success"];

  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => {
    doc.text(t, colX[i], doc.y, { width: 90 });
  });
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((a) => {
    const y = doc.y;
    const row = [
      a.createdAt.toISOString().slice(0, 10),
      a.email,
      a.user?.name || "",
      a.ip,
      a.success ? "YES" : "NO",
    ];

    row.forEach((v, i) => {
      doc.text(String(v), colX[i], y, { width: 90 });
    });
    doc.moveDown();
  });

  return doc;
}

module.exports = { exportLoginAuditToPdf };
