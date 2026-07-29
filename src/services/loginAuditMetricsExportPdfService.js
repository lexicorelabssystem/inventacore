const PDFDocument = require("pdfkit");
const {
  getLoginAuditMetricsHourly,
  getLoginAuditMetricsByIp,
  getLoginAuditMetricsByUser,
} = require("./loginAuditMetricsService");

async function exportLoginMetricsHourlyPdf(query, user) {
  const items = await getLoginAuditMetricsHourly(query, user);
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc
    .fontSize(14)
    .text("LOGIN METRICS POR HORA", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 200, 320];
  const headers = ["Hora", "Exitos", "Fallos"];
  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => doc.text(t, colX[i], doc.y, { width: 120 }));
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((m) => {
    const y = doc.y;
    doc.text(new Date(m.hour).toLocaleString(), colX[0], y, { width: 150 });
    doc.text(String(m.success), colX[1], y, { width: 80 });
    doc.text(String(m.failed), colX[2], y, { width: 80 });
    doc.moveDown();
  });

  return doc;
}

async function exportLoginMetricsIpPdf(query, user) {
  const items = await getLoginAuditMetricsByIp(query, user);
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc
    .fontSize(14)
    .text("LOGIN METRICS POR IP", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 220, 320];
  const headers = ["IP", "Exitos", "Fallos"];
  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => doc.text(t, colX[i], doc.y, { width: 120 }));
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((m) => {
    const y = doc.y;
    doc.text(String(m.ip), colX[0], y, { width: 160 });
    doc.text(String(m.success), colX[1], y, { width: 80 });
    doc.text(String(m.failed), colX[2], y, { width: 80 });
    doc.moveDown();
  });

  return doc;
}

async function exportLoginMetricsUserPdf(query, user) {
  const items = await getLoginAuditMetricsByUser(query, user);
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc
    .fontSize(14)
    .text("LOGIN METRICS POR USUARIO", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(9);

  const colX = [40, 200, 320];
  const headers = ["Usuario", "Exitos", "Fallos"];
  doc.font("Helvetica-Bold");
  headers.forEach((t, i) => doc.text(t, colX[i], doc.y, { width: 120 }));
  doc.moveDown();
  doc.font("Helvetica");

  items.forEach((m) => {
    const y = doc.y;
    const label = m.user?.name || "Desconocido";
    doc.text(label, colX[0], y, { width: 150 });
    doc.text(String(m.success), colX[1], y, { width: 80 });
    doc.text(String(m.failed), colX[2], y, { width: 80 });
    doc.moveDown();
  });

  return doc;
}

module.exports = {
  exportLoginMetricsHourlyPdf,
  exportLoginMetricsIpPdf,
  exportLoginMetricsUserPdf,
};
