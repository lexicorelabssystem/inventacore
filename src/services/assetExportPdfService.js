const PDFDocument = require("pdfkit");
const { listAllAssetsForExport } = require("./assetQueryService");
const { formatAssetCode } = require("../utils/assetCode");

async function exportAssetsToPdf(query, user) {
  const { items } = await listAllAssetsForExport(query, user);

  const doc = new PDFDocument({ margin: 28, size: "A4", layout: "landscape" });
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  doc
    .fontSize(14)
    .text("REPORTE DE INVENTARIO", { align: "center", underline: true });
  doc.moveDown();

  const colX = [28, 74, 216, 306, 382, 456, 534, 584, 670, 752];
  const headers = [
    "Codigo",
    "Nombre",
    "Responsable",
    "RUT",
    "Cargo",
    "Centro Costo",
    "Cant.",
    "Estado",
    "Estab.",
    "Sector",
  ];
  const colW = [46, 142, 90, 76, 74, 78, 44, 82, 82, 54];
  const cellPadding = 4;
  const rowGap = 3;
  const fontSize = 8;

  const drawHeader = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(fontSize);
    const headerHeights = headers.map((text, i) =>
      doc.heightOfString(text, {
        width: colW[i] - cellPadding * 2,
        lineGap: 1,
      })
    );
    const headerHeight = Math.max(18, ...headerHeights.map((height) => height + cellPadding * 2));

    doc.rect(colX[0], y, colX[colX.length - 1] + colW[colW.length - 1] - colX[0], headerHeight).fill("#E9EFF6");
    headers.forEach((text, i) => {
      doc.rect(colX[i], y, colW[i], headerHeight).stroke("#AAB7C4");
      doc.fillColor("#14213D").text(text, colX[i] + cellPadding, y + cellPadding, {
        width: colW[i] - cellPadding * 2,
        height: headerHeight - cellPadding * 2,
        align: "left",
        lineGap: 1,
      });
    });
    doc.fillColor("black");
    doc.font("Helvetica").fontSize(fontSize);
    doc.y = y + headerHeight + rowGap;
  };

  drawHeader();

  items.forEach((a, index) => {
    const row = [
      formatAssetCode(a.visibleCode || a.internalCode),
      a.name || "",
      a.responsibleName || "",
      a.responsibleRut || "",
      a.responsibleRole || "",
      a.costCenter || "",
      a.quantity ?? 1,
      a.assetState?.name || "",
      a.establishment?.name || "",
      a.dependency?.name || "",
    ];
    const rowHeight = Math.max(
      18,
      ...row.map((value, i) =>
        doc.heightOfString(String(value ?? ""), {
          width: colW[i] - cellPadding * 2,
          lineGap: 1,
        }) + cellPadding * 2
      )
    );

    if (doc.y + rowHeight > pageBottom() - 12) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(colX[0], y, colX[colX.length - 1] + colW[colW.length - 1] - colX[0], rowHeight).fill("#F8FAFC");
    }

    row.forEach((value, i) => {
      doc.rect(colX[i], y, colW[i], rowHeight).stroke("#D5DDE5");
      doc.fillColor("black").text(String(value ?? ""), colX[i] + cellPadding, y + cellPadding, {
        width: colW[i] - cellPadding * 2,
        height: rowHeight - cellPadding * 2,
        lineGap: 1,
      });
    });

    doc.y = y + rowHeight + rowGap;
  });

  return doc;
}

module.exports = { exportAssetsToPdf };
