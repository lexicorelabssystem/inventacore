const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { getOfficialBrandLogoBuffer } = require("../utils/officialBranding");
const { formatAssetCode } = require("../utils/assetCode");

const DIRECTORY_SUMMARY_PDF_LIMITS = [24, 14, 20, 26, 6, 7, 6, 16];
const DIRECTORY_DETAIL_PDF_LIMITS = [12, 34, 20, 14, 6, 12, 10, 16, 54];

function normalizeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CL");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMovementText(movement) {
  const typeMap = {
    INVENTORY_CHECK: "Registro inicial",
    TRANSFER: "Transferencia",
    STATUS_CHANGE: "Cambio de estado",
    RELOCATION: "Reubicacion",
  };
  const typeLabel = typeMap[movement?.type] || normalizeText(movement?.type, "Movimiento");
  const reason = normalizeText(movement?.reasonCode || movement?.reason, "sin motivo");
  const route = [
    movement?.fromDependency?.name ? `Origen: ${movement.fromDependency.name}` : null,
    movement?.toDependency?.name ? `Destino: ${movement.toDependency.name}` : null,
  ]
    .filter(Boolean)
    .join(" -> ");
  const owner = movement?.user?.name ? `Usuario: ${movement.user.name}` : null;
  return [typeLabel, reason, route, owner].filter(Boolean).join(" | ");
}

function buildMovementHistoryText(asset, includeHistory, options = {}) {
  const singleLine = Boolean(options.singleLine);
  const maxLength = Number(options.maxLength);
  if (!includeHistory) return "Historial desactivado";
  const movements = Array.isArray(asset?.movements) ? asset.movements : [];
  if (!movements.length) return "Sin movimientos";
  const text = movements
    .slice(0, 3)
    .map((movement) => `${formatDateTime(movement.createdAt)} ${formatMovementText(movement)}`)
    .join(singleLine ? " / " : "\n");
  if (Number.isFinite(maxLength) && maxLength > 0) {
    return truncateCellText(text, maxLength, "Sin movimientos");
  }
  return text;
}

function summarizeDirectory(directory) {
  const groups = Array.isArray(directory) ? directory : [];
  return groups.reduce(
    (acc, group) => {
      acc.responsibles += 1;
      acc.assets += Number(group?.assetCount || 0);
      acc.units += Number(group?.unitCount || 0);
      acc.movements += Number(group?.movementCount || 0);
      return acc;
    },
    { responsibles: 0, assets: 0, units: 0, movements: 0 }
  );
}

function paintHeader(row, color) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD5DDE5" } },
      left: { style: "thin", color: { argb: "FFD5DDE5" } },
      bottom: { style: "thin", color: { argb: "FFD5DDE5" } },
      right: { style: "thin", color: { argb: "FFD5DDE5" } },
    };
  });
}

function paintBodyRow(row, fillColor) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    cell.alignment = { vertical: "top", wrapText: true };
    if (fillColor) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    }
  });
}

async function buildPlanchetaDirectoryExcel(directory, meta) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Directorio");
  const groups = Array.isArray(directory) ? directory : [];
  const summary = summarizeDirectory(groups);

  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
  };

  const logo = getOfficialBrandLogoBuffer();
  if (logo) {
    try {
      const imageId = workbook.addImage({ buffer: logo, extension: "png" });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 60 },
      });
    } catch {
      // ignore logo errors
    }
  }

  sheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 24 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 30 },
  ];

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "DIRECTORIO POR FUNCIONARIO";
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B4332" },
  };

  sheet.addRow([]);
  sheet.addRow([
    "Encabezado:",
    `${meta.institution || ""} | ${meta.establishment || ""} | Sector: ${meta.dependency || "Todos"}`,
  ]);
  sheet.addRow([
    "Rango:",
    `${meta.dateRange || "Sin filtro"} | ${
      meta.ministryText || "Resumen de bienes verificados en el sector indicado."
    }`,
  ]);
  sheet.addRow(["Historial:", meta.includeHistory ? "Incluido" : "Desactivado"]);
  sheet.addRow(["Fecha:", new Date().toLocaleDateString("es-CL")]);

  sheet.addRow([]);
  const metricsRow = sheet.addRow([
    `Funcionarios: ${summary.responsibles}`,
    `Activos: ${summary.assets}`,
    `Unidades: ${summary.units}`,
    `Movimientos: ${summary.movements}`,
    "",
    "",
    "",
    "",
    "",
  ]);
  metricsRow.font = { bold: true };
  for (let i = 1; i <= 4; i++) {
    const cell = metricsRow.getCell(i);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9DBA9D" } },
      left: { style: "thin", color: { argb: "FF9DBA9D" } },
      bottom: { style: "thin", color: { argb: "FF9DBA9D" } },
      right: { style: "thin", color: { argb: "FF9DBA9D" } },
    };
  }

  sheet.addRow([]);
  const summaryTitle = sheet.addRow([
    "RESUMEN POR FUNCIONARIO",
    "RUT",
    "Cargo",
    "Centro de costo",
    "Sectores",
    "Activos",
    "Unidades",
    "Mov.",
    "Ultimo movimiento",
  ]);
  paintHeader(summaryTitle, "FF2D6A4F");

  groups.forEach((group, idx) => {
    const row = sheet.addRow([
      group.responsibleName || "Sin asignar",
      group.responsibleRut || "-",
      (group.responsibleRoles || []).join(" / ") || "-",
      (group.costCenters || []).join(" / ") || "-",
      (group.dependencies || []).join(" | ") || "-",
      Number(group.assetCount || 0),
      Number(group.unitCount || 0),
      Number(group.movementCount || 0),
      formatDateTime(group.latestMovementAt),
    ]);
    paintBodyRow(row, idx % 2 === 0 ? "FFF8FBF8" : null);
  });

  sheet.addRow([]);
  const detailTitle = sheet.addRow(["DETALLE POR FUNCIONARIO"]);
  sheet.mergeCells(`A${detailTitle.number}:I${detailTitle.number}`);
  const detailCell = sheet.getCell(`A${detailTitle.number}`);
  detailCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  detailCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  detailCell.alignment = { horizontal: "center", vertical: "middle" };

  groups.forEach((group) => {
    const groupTitle = sheet.addRow([
      `Funcionario: ${group.responsibleName || "Sin asignar"}`,
    ]);
    sheet.mergeCells(`A${groupTitle.number}:I${groupTitle.number}`);
    const groupCell = sheet.getCell(`A${groupTitle.number}`);
    groupCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    groupCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B4332" },
    };
    groupCell.alignment = { horizontal: "left", vertical: "middle" };

    const infoRow = sheet.addRow([
      `RUT: ${group.responsibleRut || "-"}`,
      `Cargo: ${(group.responsibleRoles || []).join(" / ") || "-"}`,
      `CC: ${(group.costCenters || []).join(" / ") || "-"}`,
      `Sectores: ${(group.dependencies || []).join(" | ") || "-"}`,
      `Activos: ${group.assetCount || 0}`,
      `Unidades: ${group.unitCount || 0}`,
      `Movimientos: ${group.movementCount || 0}`,
      `Ultimo mov.: ${formatDateTime(group.latestMovementAt)}`,
      meta.includeHistory ? "Historial incluido" : "Historial desactivado",
    ]);
    paintBodyRow(infoRow, "FFF8FAFC");

    const header = sheet.addRow([
      "Codigo",
      "Bien",
      "Sector",
      "Estado",
      "Cant.",
      "Adquisicion",
      "Vida util",
      "Ultimo mov.",
      "Historial reciente",
    ]);
    paintHeader(header, "FF475569");

    (group.assets || []).forEach((asset, idx) => {
      const row = sheet.addRow([
        formatAssetCode(asset.visibleCode || asset.internalCode),
        normalizeText(asset.name, "-"),
        normalizeText(asset.dependencyName, "-"),
        normalizeText(asset.assetStateName, "-"),
        Number(asset.quantity || 0),
        formatDate(asset.acquisitionDate),
        asset.usefulLifeYears || "-",
        asset.movements?.length ? formatDateTime(asset.movements[0].createdAt) : "-",
        buildMovementHistoryText(asset, meta.includeHistory),
      ]);
      row.height = Math.max(
        22,
        Math.min(
          72,
          18 +
            Math.ceil(
              Math.max(
                String(asset.name || "").length,
                String(asset.movements?.[0]?.reason || "").length,
                String(buildMovementHistoryText(asset, meta.includeHistory)).length
              ) / 70
            ) * 12
        )
      );
      paintBodyRow(row, idx % 2 === 0 ? "FFF8FBF8" : null);
    });

    sheet.addRow([]);
  });

  const widths = [16, 26, 16, 16, 22, 10, 10, 12, 28];
  widths.forEach((width, idx) => {
    sheet.getColumn(idx + 1).width = width;
  });
  sheet.getColumn(8).alignment = { vertical: "top", wrapText: true };
  sheet.getColumn(9).alignment = { vertical: "top", wrapText: true };
  sheet.views = [{ state: "frozen", ySplit: summaryTitle.number }];

  return workbook;
}

function drawMetricCard(doc, x, y, width, height, title, value, note) {
  doc.roundedRect(x, y, width, height, 10).fill("#F8FAFC").stroke("#CBD5E1");
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(9).text(title, x + 10, y + 10);
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(18).text(String(value), x + 10, y + 26, {
    width: width - 20,
    align: "left",
  });
  if (note) {
    doc.fillColor("#64748B").font("Helvetica").fontSize(8).text(note, x + 10, y + height - 18, {
      width: width - 20,
    });
  }
}

function drawSummaryTable(doc, groups, left, pageWidth, includeHistory) {
  const summaryTop = doc.y + 8;
  const rowHeight = 18;
  const tableHeight = Math.min(160, 44 + Math.max(0, Math.min(groups.length, 6)) * rowHeight);
  doc.roundedRect(left, summaryTop, pageWidth, tableHeight, 10).fill("#FFFFFF").stroke("#D7DEE7");
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(10).text(
    "Resumen por funcionario",
    left + 12,
    summaryTop + 10
  );

  const headers = [
    "Funcionario",
    "RUT",
    "Cargo",
    "Sectores",
    "Activos",
    "Unidades",
    "Mov.",
    "Ultimo mov.",
  ];
  const widths = [160, 86, 126, 162, 46, 52, 42, 92];
  const xPositions = [];
  let cursor = left + 12;
  widths.forEach((width, idx) => {
    xPositions[idx] = cursor;
    cursor += width;
  });

  const headerY = summaryTop + 30;
  doc.font("Helvetica-Bold").fontSize(8);
  headers.forEach((header, idx) => {
    doc.rect(xPositions[idx], headerY, widths[idx], 16).fill("#E2E8F0").stroke("#CBD5E1");
    doc.fillColor("#0F172A").text(header, xPositions[idx] + 3, headerY + 3, {
      width: widths[idx] - 6,
      align: "left",
    });
  });

  let rowY = headerY + 16;
  groups.slice(0, 6).forEach((group, idx) => {
    const values = [
      truncateCellText(normalizeText(group.responsibleName, "-"), DIRECTORY_SUMMARY_PDF_LIMITS[0]),
      truncateCellText(normalizeText(group.responsibleRut, "-"), DIRECTORY_SUMMARY_PDF_LIMITS[1]),
      truncateCellText((group.responsibleRoles || []).join(" / ") || "-", DIRECTORY_SUMMARY_PDF_LIMITS[2]),
      truncateCellText((group.dependencies || []).join(" | ") || "-", DIRECTORY_SUMMARY_PDF_LIMITS[3]),
      truncateCellText(String(group.assetCount || 0), DIRECTORY_SUMMARY_PDF_LIMITS[4]),
      truncateCellText(String(group.unitCount || 0), DIRECTORY_SUMMARY_PDF_LIMITS[5]),
      truncateCellText(String(group.movementCount || 0), DIRECTORY_SUMMARY_PDF_LIMITS[6]),
      truncateCellText(formatDateTime(group.latestMovementAt), DIRECTORY_SUMMARY_PDF_LIMITS[7]),
    ];
    values.forEach((value, valueIdx) => {
      if (idx % 2 === 0) {
        doc.rect(xPositions[valueIdx], rowY, widths[valueIdx], rowHeight).fill("#F8FAFC");
      }
      doc.rect(xPositions[valueIdx], rowY, widths[valueIdx], rowHeight).stroke("#E2E8F0");
      doc.fillColor("#334155").font("Helvetica").fontSize(8).text(value, xPositions[valueIdx] + 3, rowY + 3, {
        width: widths[valueIdx] - 6,
        lineBreak: false,
        ellipsis: true,
      });
    });
    rowY += rowHeight;
  });

  if (groups.length > 6) {
    doc.fillColor("#64748B").font("Helvetica").fontSize(8).text(
      `+${groups.length - 6} funcionarios mas`,
      left + 12,
      summaryTop + tableHeight - 16
    );
  } else if (!includeHistory) {
    doc.fillColor("#64748B").font("Helvetica").fontSize(8).text(
      "Historial desactivado en este alcance",
      left + 12,
      summaryTop + tableHeight - 16
    );
  }

  doc.y = summaryTop + tableHeight + 8;
}

function drawGroupPage(doc, group, includeHistory) {
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const widths = [48, 132, 92, 50, 32, 64, 46, 76, 164];
  const xPositions = [];
  let cursor = left;
  widths.forEach((width, idx) => {
    xPositions[idx] = cursor;
    cursor += width;
  });

  function drawTableHeader() {
    const headerY = doc.y;
    const headers = [
      "Codigo",
      "Bien",
      "Sector",
      "Estado",
      "Cant.",
      "Adquisicion",
      "Vida util",
      "Ultimo mov.",
      "Historial reciente",
    ];
    headers.forEach((header, idx) => {
      doc.rect(xPositions[idx], headerY, widths[idx], 18).fill("#E2E8F0").stroke("#CBD5E1");
      doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(8).text(header, xPositions[idx] + 3, headerY + 3, {
        width: widths[idx] - 6,
        align: "left",
      });
    });
    doc.y = headerY + 20;
  }

  function drawHeader(continuation = false) {
    if (continuation) {
      doc.addPage();
    }
    const headerY = doc.y + 2;
    const boxHeight = 74;
    doc.roundedRect(left, headerY, pageWidth, boxHeight, 8).fill("#F8FAFC").stroke("#CBD5E1");
    doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(14).text(
      `Funcionario: ${normalizeText(group.responsibleName, "Sin asignar")}`,
      left + 12,
      headerY + 10
    );
    doc.fillColor("#334155").font("Helvetica").fontSize(9).text(
      `RUT: ${normalizeText(group.responsibleRut, "-")} | Cargo: ${
        (group.responsibleRoles || []).join(" / ") || "-"
      } | CC: ${(group.costCenters || []).join(" / ") || "-"}`,
      left + 12,
      headerY + 28,
      { width: pageWidth - 24 }
    );
    doc.text(
      `Sectores: ${(group.dependencies || []).join(" | ") || "-"} | Activos: ${
        group.assetCount || 0
      } | Unidades: ${group.unitCount || 0} | Movimientos: ${group.movementCount || 0} | Ultimo mov.: ${
        formatDateTime(group.latestMovementAt)
      }`,
      left + 12,
      headerY + 44,
      { width: pageWidth - 24 }
    );
    if (!includeHistory) {
      doc.fillColor("#64748B").fontSize(8).text("Historial desactivado en esta exportacion", left + 12, headerY + 60);
    }
    doc.fillColor("black");
    doc.y = headerY + boxHeight + 10;
    drawTableHeader();
  }

  drawHeader(false);

  (group.assets || []).forEach((asset, idx) => {
    const historyText = buildMovementHistoryText(asset, includeHistory, {
      singleLine: true,
      maxLength: DIRECTORY_DETAIL_PDF_LIMITS[8],
    });
    const values = [
      truncateCellText(formatAssetCode(asset.visibleCode || asset.internalCode), DIRECTORY_DETAIL_PDF_LIMITS[0]),
      truncateCellText(normalizeText(asset.name, "-"), DIRECTORY_DETAIL_PDF_LIMITS[1]),
      truncateCellText(normalizeText(asset.dependencyName, "-"), DIRECTORY_DETAIL_PDF_LIMITS[2]),
      truncateCellText(normalizeText(asset.assetStateName, "-"), DIRECTORY_DETAIL_PDF_LIMITS[3]),
      truncateCellText(String(asset.quantity || 0), DIRECTORY_DETAIL_PDF_LIMITS[4]),
      truncateCellText(formatDate(asset.acquisitionDate), DIRECTORY_DETAIL_PDF_LIMITS[5]),
      truncateCellText(asset.usefulLifeYears || "-", DIRECTORY_DETAIL_PDF_LIMITS[6]),
      truncateCellText(
        asset.movements?.length ? formatDateTime(asset.movements[0].createdAt) : "-",
        DIRECTORY_DETAIL_PDF_LIMITS[7]
      ),
      truncateCellText(historyText, DIRECTORY_DETAIL_PDF_LIMITS[8]),
    ];
    const cellPadding = 4;
    const rowHeight = 24;

    if (doc.y + rowHeight > pageBottom() - 24) {
      drawHeader(true);
    }

    const rowY = doc.y;
    values.forEach((value, valueIdx) => {
      if (idx % 2 === 0) {
        doc.rect(xPositions[valueIdx], rowY, widths[valueIdx], rowHeight).fill("#F8FAFC");
      }
      doc.rect(xPositions[valueIdx], rowY, widths[valueIdx], rowHeight).stroke("#CBD5E1");
      doc.fillColor("#334155").font("Helvetica").fontSize(8).text(value, xPositions[valueIdx] + cellPadding, rowY + cellPadding, {
        width: widths[valueIdx] - cellPadding * 2,
        height: rowHeight - cellPadding * 2,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.y = rowY + rowHeight + 3;
  });
}

function buildPlanchetaDirectoryPdf(directory, meta) {
  const groups = Array.isArray(directory) ? directory : [];
  const summary = summarizeDirectory(groups);
  const doc = new PDFDocument({ margin: 28, size: "A4", layout: "landscape" });
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerTop = 24;
  const logoWidth = 82;
  let logoBottom = headerTop;

  const logo = getOfficialBrandLogoBuffer();
  if (logo) {
    try {
      const logoImage = doc.openImage(logo);
      const logoHeight = (logoImage.height * logoWidth) / Math.max(logoImage.width, 1);
      doc.image(logoImage, left, headerTop, { width: logoWidth });
      logoBottom = headerTop + logoHeight;
    } catch {
      // ignore logo errors
    }
  }

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(18).text(
    "DIRECTORIO POR FUNCIONARIO",
    left,
    headerTop + 10,
    { width: pageWidth, align: "center" }
  );
  const titleBottom = doc.y;
  const metadataStartY = Math.max(titleBottom + 6, logoBottom + 8);

  doc.fillColor("#475569").font("Helvetica").fontSize(9).text(
    `${meta.institution || ""} | ${meta.establishment || ""} | Sector: ${meta.dependency || "Todos"}`,
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
  doc.fillColor("#64748B").font("Helvetica").fontSize(8).text(
    `Historial: ${meta.includeHistory ? "Incluido" : "Desactivado"} | Fecha: ${new Date().toLocaleDateString(
      "es-CL"
    )}`,
    left,
    doc.y + 2,
    { width: pageWidth, align: "center" }
  );

  const cardY = doc.y + 16;
  const gap = 12;
  const cardW = (pageWidth - gap * 3) / 4;
  drawMetricCard(doc, left, cardY, cardW, 76, "Funcionarios", summary.responsibles, "Agrupados por responsable");
  drawMetricCard(doc, left + cardW + gap, cardY, cardW, 76, "Activos", summary.assets, "Bienes visibles");
  drawMetricCard(
    doc,
    left + (cardW + gap) * 2,
    cardY,
    cardW,
    76,
    "Unidades",
    summary.units,
    "Cantidad total"
  );
  drawMetricCard(
    doc,
    left + (cardW + gap) * 3,
    cardY,
    cardW,
    76,
    "Movimientos",
    summary.movements,
    "Incluye reasignaciones y bajas"
  );

  doc.y = cardY + 96;
  drawSummaryTable(doc, groups, left, pageWidth, meta.includeHistory);

  groups.forEach((group) => {
    doc.addPage();
    drawGroupPage(doc, group, meta.includeHistory);
  });

  return doc;
}

module.exports = {
  buildPlanchetaDirectoryExcel,
  buildPlanchetaDirectoryPdf,
};
