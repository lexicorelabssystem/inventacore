const PDFDocument = require("pdfkit");
const { getOfficialBrandLogoBuffer, getOfficialBrandName } = require("../utils/officialBranding");
const { formatAssetCode } = require("../utils/assetCode");
const COMPACT_TITLE = "SERVICIO DE PROTECCION ESPECIALIZADA A LA NINEZ Y ADOLESCENCIA";
const PLANCHETA_COMPACT_PDF_COLUMN_WIDTHS = [78, 250, 170, 110, 70, 70];
const PLANCHETA_COMPACT_PDF_CELL_LIMITS = [12, 58, 28, 20, 14, 10];

function normalizeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CL");
}

function normalizeStateName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getAdministrativeQualityLabel(asset) {
  if (asset?.isDeleted) return "Dado de baja";
  const normalizedState = normalizeStateName(asset?.assetState?.name || "");
  if (normalizedState.includes("BUENO")) return "Operativo";
  if (normalizedState.includes("MALO") || normalizedState.includes("CRIT")) {
    return "Observado";
  }
  if (normalizedState.includes("REGULAR")) return "En revision";
  if (normalizedState.includes("BAJA")) return "En baja";
  return "Vigente";
}

function extractPrimaryAssetName(asset) {
  const raw = String(asset?.name || "").trim();
  if (!raw) return "Activo";
  const firstPart = raw.split(/\s*-\s*/)[0];
  const normalized = String(firstPart || "").trim();
  return normalized || raw;
}

function buildAssetDescription(asset, maxLength = 46) {
  const text = extractPrimaryAssetName(asset).replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(1, maxLength - 1)).trim()}...`;
}

function truncateCellText(value, maxLength, fallback = "-") {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;
  if (!Number.isFinite(maxLength) || maxLength <= 0 || normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trim()}...`;
}

function summarizeAssets(assets) {
  const items = Array.isArray(assets) ? assets : [];
  return items.reduce(
    (acc, item) => {
      acc.totalAssets += 1;
      acc.totalUnits += Math.max(Number(item?.quantity) || 0, 1);
      acc.totalValue += Math.max(Number(item?.acquisitionValue) || 0, 0);
      acc.totalAnnualDepreciation += Math.max(Number(item?.depreciationAnnualValue) || 0, 0);
      return acc;
    },
    { totalAssets: 0, totalUnits: 0, totalValue: 0, totalAnnualDepreciation: 0 }
  );
}

function drawMetricCard(doc, x, y, width, height, title, value, note) {
  doc.roundedRect(x, y, width, height, 9).fill("#F8FAFC").stroke("#CBD5E1");
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8.5).text(title, x + 10, y + 8);
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(16).text(String(value), x + 10, y + 24, {
    width: width - 20,
  });
  if (note) {
    doc.fillColor("#64748B").font("Helvetica").fontSize(7.5).text(note, x + 10, y + height - 16, {
      width: width - 20,
    });
  }
}

function drawTableHeader(doc, left, widths, y) {
  const headers = [
    "Codigo",
    "Caracteristicas basicas",
    "Responsable",
    "Unidad operativa",
    "Calidad Adm.",
    "Fecha",
  ];
  headers.forEach((header, idx) => {
    doc.rect(left + widths.slice(0, idx).reduce((acc, val) => acc + val, 0), y, widths[idx], 18)
      .fill("#E2E8F0")
      .stroke("#CBD5E1");
    doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(7.8).text(
      header,
      left + widths.slice(0, idx).reduce((acc, val) => acc + val, 0) + 3,
      y + 3,
      {
        width: widths[idx] - 6,
        align: "left",
      }
    );
  });
}

function drawAssetRow(doc, left, widths, y, asset, idx) {
  const values = [
    truncateCellText(formatAssetCode(asset.visibleCode || asset.internalCode), PLANCHETA_COMPACT_PDF_CELL_LIMITS[0]),
    truncateCellText(buildAssetDescription(asset, 86), PLANCHETA_COMPACT_PDF_CELL_LIMITS[1]),
    truncateCellText(normalizeText(asset.responsibleName, "-"), PLANCHETA_COMPACT_PDF_CELL_LIMITS[2]),
    truncateCellText(normalizeText(asset.dependency?.name, "-"), PLANCHETA_COMPACT_PDF_CELL_LIMITS[3]),
    truncateCellText(getAdministrativeQualityLabel(asset), PLANCHETA_COMPACT_PDF_CELL_LIMITS[4]),
    truncateCellText(formatDate(asset.acquisitionDate), PLANCHETA_COMPACT_PDF_CELL_LIMITS[5]),
  ];
  const rowHeight = 18;
  let cursor = left;
  values.forEach((value, valueIdx) => {
    if (idx % 2 === 0) {
      doc.rect(cursor, y, widths[valueIdx], rowHeight).fill("#F8FAFC");
    }
    doc.rect(cursor, y, widths[valueIdx], rowHeight).stroke("#CBD5E1");
    doc.fillColor("#334155").font("Helvetica").fontSize(7.6).text(value, cursor + 3, y + 3, {
      width: widths[valueIdx] - 6,
      height: rowHeight - 6,
      lineBreak: false,
      ellipsis: true,
    });
    cursor += widths[valueIdx];
  });
}

function appendSignaturePage(doc, meta) {
  doc.addPage();
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const logo = getOfficialBrandLogoBuffer();
  const logoWidth = 72;
  let titleY = top + 10;

  if (logo) {
    try {
      const image = doc.openImage(logo);
      const logoHeight = (image.height * logoWidth) / Math.max(image.width, 1);
      doc.image(image, left, top, { width: logoWidth });
      titleY = Math.max(titleY, top + (logoHeight - 30) / 2);
    } catch {
      // ignore logo errors
    }
  }

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(33).text("VALIDACION Y FIRMAS", left, titleY, {
    width: pageWidth,
    align: "center",
  });

  const cardY = top + 90;
  const cardH = 210;
  doc.roundedRect(left + 40, cardY, pageWidth - 80, cardH, 10).fill("#F1F5F9").stroke("#CBD5E1");

  const lineX = left + 54;
  const infoW = pageWidth - 108;
  let infoY = cardY + 16;
  const infoLines = [
    `Fecha: ${new Date().toLocaleDateString("es-CL")}`,
    `Establecimiento: ${meta.establishment || "-"}`,
    `Departamento: ${meta.institution || getOfficialBrandName()}`,
    `Unidad operativa: ${meta.dependency || "Todos"}`,
    `Identificacion del responsable del bien: ${normalizeText(meta.responsibleName, "Sin asignar")}`,
    `Identificacion del encargado de inventario institucional: ${normalizeText(
      meta.chiefName,
      "Jefe de Sector"
    )}`,
  ];
  infoLines.forEach((line, idx) => {
    doc.fillColor("#0F172A")
      .font("Helvetica")
      .fontSize(10.5)
      .text(line, lineX, infoY, { width: infoW, align: "left" });
    infoY = doc.y + 6;
  });

  const signaturesTop = cardY + cardH + 44;
  const signatureWidth = (pageWidth - 170) / 2;
  const leftSignatureX = left + 80;
  const rightSignatureX = leftSignatureX + signatureWidth + 54;
  const signatureLineY = signaturesTop + 34;

  doc.fillColor("#1E293B").font("Helvetica").fontSize(11).text("Firma responsable del bien", leftSignatureX, signaturesTop, {
    width: signatureWidth,
    align: "center",
  });
  doc.text("Firma encargado de inventario", rightSignatureX, signaturesTop, {
    width: signatureWidth,
    align: "center",
  });

  doc.moveTo(leftSignatureX, signatureLineY).lineTo(leftSignatureX + signatureWidth, signatureLineY).stroke("#94A3B8");
  doc.moveTo(rightSignatureX, signatureLineY).lineTo(rightSignatureX + signatureWidth, signatureLineY).stroke("#94A3B8");

  doc.font("Helvetica").fontSize(10.5).fillColor("#0F172A").text(
    normalizeText(meta.responsibleName, "Sin asignar"),
    leftSignatureX,
    signatureLineY + 10,
    {
      width: signatureWidth,
      align: "center",
    }
  );
  doc.text(normalizeText(meta.chiefName, "Jefe de Sector"), rightSignatureX, signatureLineY + 10, {
    width: signatureWidth,
    align: "center",
  });
}

function buildPlanchetaCompactPdf(assets, meta) {
  const normalizedAssets = Array.isArray(assets) ? assets : [];
  const summary = summarizeAssets(normalizedAssets);
  const doc = new PDFDocument({ margin: 22, size: "A4", layout: "landscape" });
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const logoX = left;
  const logoY = top - 2;
  const logoWidth = 70;
  let logoBottom = top;

  const logo = getOfficialBrandLogoBuffer();
  if (logo) {
    try {
      const logoImage = doc.openImage(logo);
      const logoHeight = (logoImage.height * logoWidth) / Math.max(logoImage.width, 1);
      doc.image(logoImage, logoX, logoY, { width: logoWidth });
      logoBottom = logoY + logoHeight;
    } catch {
      // ignore logo errors
    }
  }

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(17).text(
    COMPACT_TITLE,
    left,
    top + 8,
    { width: pageWidth, align: "center" }
  );
  const titleBottom = doc.y;
  const metadataStartY = Math.max(titleBottom + 6, logoBottom + 8);

  doc.fillColor("#475569").font("Helvetica").fontSize(9).text(
    `${meta.institution || getOfficialBrandName()} | ${meta.establishment || ""} | Sector: ${
      meta.dependency || "Todos"
    }`,
    left,
    metadataStartY,
    { width: pageWidth, align: "center" }
  );
  doc.text(
    `Rango: ${meta.dateRange || "Sin filtro"} | ${
      meta.ministryText || "Resumen de bienes verificados en el sector indicado."
    }`,
    left,
    doc.y + 2,
    { width: pageWidth, align: "center" }
  );

  const cardY = doc.y + 12;
  const gap = 10;
  const cardW = (pageWidth - gap) / 2;
  const responsibleName = normalizeText(meta?.responsibleName, "Sin asignar");
  drawMetricCard(doc, left, cardY, cardW, 66, "Registros", summary.totalAssets, "Activos listados");
  drawMetricCard(
    doc,
    left + cardW + gap,
    cardY,
    cardW,
    66,
    "Responsable",
    responsibleName,
    "Funcionario a cargo"
  );

  const tableTop = cardY + 82;
  const widths = PLANCHETA_COMPACT_PDF_COLUMN_WIDTHS;
  const tableWidth = widths.reduce((acc, width) => acc + width, 0);
  const tableLeft = left + Math.max(0, (pageWidth - tableWidth) / 2);
  doc.roundedRect(tableLeft, tableTop - 4, tableWidth, 26 + Math.min(normalizedAssets.length, 18) * 18, 8)
    .fill("#FFFFFF")
    .stroke("#CBD5E1");
  drawTableHeader(doc, tableLeft, widths, tableTop);
  let rowY = tableTop + 18;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  normalizedAssets.forEach((asset, idx) => {
    if (rowY + 18 > pageBottom() - 8) {
      doc.addPage();
      rowY = doc.page.margins.top;
      drawTableHeader(doc, tableLeft, widths, rowY);
      rowY += 18;
    }
    drawAssetRow(doc, tableLeft, widths, rowY, asset, idx);
    rowY += 18;
  });

  doc.fillColor("#64748B").font("Helvetica").fontSize(7.5).text(
    "Formato compacto sin graficos. Para detalle extendido usar la plancheta formal.",
    left,
    rowY + 22,
    { width: pageWidth, align: "right" }
  );

  doc.fillColor("#475569").font("Helvetica").fontSize(7.8).text(
    "Responsabilidad: el funcionario responsable debe velar por el buen uso, custodia y resguardo de los recursos asignados.",
    left,
    rowY + 8,
    { width: pageWidth - 80, align: "left" }
  );

  appendSignaturePage(doc, meta || {});

  return doc;
}

module.exports = { buildPlanchetaCompactPdf };
