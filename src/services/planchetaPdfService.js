const PDFDocument = require("pdfkit");
const { getOfficialBrandLogoBuffer, getOfficialBrandName } = require("../utils/officialBranding");
const { formatAssetCode } = require("../utils/assetCode");

const PLANCHETA_PDF_COLUMN_WIDTHS = [96, 338, 174, 90, 82];
const PLANCHETA_PDF_CELL_LIMITS = [12, 72, 28, 16, 10];

function normalizeStateName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getStateColor(stateName) {
  const normalized = normalizeStateName(stateName);
  if (normalized.includes("BUENO")) {
    return { fill: "#4C956C", text: "#163020" };
  }
  if (normalized.includes("BAJA")) {
    return { fill: "#6B7280", text: "#1F2937" };
  }
  if (normalized.includes("MALO") || normalized.includes("CRIT")) {
    return { fill: "#C1121F", text: "#5F0F16" };
  }
  return { fill: "#3B82F6", text: "#1E3A8A" };
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

function truncateVisualText(value, maxLength) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1)).trim()}...`;
}

function toSingleLineCell(value, maxLength, fallback = "-") {
  const truncated = truncateVisualText(value, maxLength);
  return truncated || fallback;
}

function extractPrimaryAssetName(asset) {
  const raw = String(asset?.name || "").trim();
  if (!raw) return "Activo";
  const firstPart = raw.split(/\s*-\s*/)[0];
  const normalized = String(firstPart || "").trim();
  return normalized || raw;
}

function buildAssetDescription(asset, maxLength = 86) {
  return truncateVisualText(extractPrimaryAssetName(asset), maxLength);
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "$0";
  return `$${Math.round(amount).toLocaleString("es-CL")}`;
}

function drawInsightsSection(doc, meta, tableLeft, tableWidth) {
  const insights = meta?.insights;
  if (!insights) return;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const weeklyUnits = Number(insights?.weekly?.units || 0);
  const monthlyUnits = Number(insights?.monthly?.units || 0);
  const maxUnits = Math.max(weeklyUnits, monthlyUnits, 1);
  const stateOverview = Array.isArray(insights?.stateOverview) ? insights.stateOverview : [];
  const monthlyItems = Array.isArray(insights?.monthly?.items) ? insights.monthly.items : [];

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#14213D").text(
    "RESUMEN DE BAJAS Y ESTADOS",
    tableLeft,
    doc.y,
    { width: tableWidth, align: "center" }
  );
  doc.moveDown(1);

  const boxY = doc.y;
  const boxH = 92;
  doc.roundedRect(tableLeft, boxY, tableWidth, boxH, 8).fill("#F8FAFC").stroke("#CBD5E1");
  doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10).text("Resumen de bajas", tableLeft + 14, boxY + 12);
  doc.font("Helvetica").fontSize(9);
  doc.text(`Ultimos 7 dias: ${insights?.weekly?.count || 0} registros / ${weeklyUnits} bienes`, tableLeft + 14, boxY + 30);
  doc.text(`Ultimos 30 dias: ${insights?.monthly?.count || 0} registros / ${monthlyUnits} bienes`, tableLeft + 14, boxY + 46);
  const chartX = tableLeft + tableWidth / 2;
  const chartY = boxY + 24;
  const chartH = 14;
  const chartW = tableWidth / 2 - 34;
  const weeklyBar = Math.max(8, Math.round((weeklyUnits / maxUnits) * chartW));
  const monthlyBar = Math.max(8, Math.round((monthlyUnits / maxUnits) * chartW));
  doc.fillColor("#64748B").text("Semanal", chartX, chartY - 2, { width: 54 });
  doc.rect(chartX + 58, chartY, chartW, chartH).stroke("#CBD5E1");
  doc.rect(chartX + 58, chartY, weeklyBar, chartH).fill("#64748B");
  doc.fillColor("#0F172A").text(String(weeklyUnits), chartX + 58 + chartW + 8, chartY - 1, { width: 24 });
  doc.fillColor("#1D4ED8").text("Mensual", chartX, chartY + 26 - 2, { width: 54 });
  doc.rect(chartX + 58, chartY + 26, chartW, chartH).stroke("#CBD5E1");
  doc.rect(chartX + 58, chartY + 26, monthlyBar, chartH).fill("#1D4ED8");
  doc.fillColor("#0F172A").text(String(monthlyUnits), chartX + 58 + chartW + 8, chartY + 25, { width: 24 });
  doc.fillColor("black");
  doc.y = boxY + boxH + 14;

  if (stateOverview.length) {
    const stateBoxY = doc.y;
    const stateBoxH = 108;
    const maxStateUnits = Math.max(...stateOverview.map((row) => Number(row.count || 0)), 1);
    doc.roundedRect(tableLeft, stateBoxY, tableWidth, stateBoxH, 8).fill("#F8FAFC").stroke("#CBD5E1");
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10).text(
      "Distribucion actual por estado (incluye dados de baja)",
      tableLeft + 14,
      stateBoxY + 10
    );
    stateOverview.slice(0, 5).forEach((row, idx) => {
      const y = stateBoxY + 34 + idx * 14;
      const label = String(row.label || "Sin estado");
      const count = Number(row.count || 0);
      const barWidth = Math.max(8, Math.round((count / maxStateUnits) * 220));
      doc.fillColor("#334155").font("Helvetica").fontSize(8.5).text(label, tableLeft + 14, y, {
        width: 120,
        ellipsis: true,
      });
      doc.rect(tableLeft + 140, y + 1, 220, 8).stroke("#CBD5E1");
      doc.rect(tableLeft + 140, y + 1, barWidth, 8).fill(getStateColor(label).fill);
      doc.fillColor("#0F172A").text(String(count), tableLeft + 370, y - 1, { width: 28, align: "right" });
    });
    doc.fillColor("black");
    doc.y = stateBoxY + stateBoxH + 12;
  }

  if (monthlyItems.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#14213D").text("Activos dados de baja recientes", tableLeft, doc.y);
    doc.moveDown(0.5);
    monthlyItems.slice(0, 6).forEach((item) => {
      if (doc.y + 18 > pageBottom() - 40) return;
      const label = `${formatAssetCode(item.visibleCode || item.internalCode)} | ${item.name || "Sin nombre"} | ${
        item.dependencyName || "Sin sector"
      } | ${new Date(item.deletedAt).toLocaleDateString()}`;
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(`- ${label}`, tableLeft + 8, doc.y, {
        width: tableWidth - 16,
        ellipsis: true,
      });
      doc.moveDown(0.35);
    });
    doc.moveDown(0.5);
  }

  doc.fillColor("black");
}

function buildPlanchetaPdf(assets, meta) {
  const doc = new PDFDocument({ margin: 28, size: "A4", layout: "landscape" });
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const tableLeft = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const normalizedAssets = Array.isArray(assets) ? assets : [];
  const totalAssets = normalizedAssets.length;
  const totalUnits = normalizedAssets.reduce(
    (acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1),
    0
  );
  const totalAnnualDepreciation = normalizedAssets.reduce(
    (acc, item) => acc + Math.max(Number(item?.depreciationAnnualValue) || 0, 0),
    0
  );
  const stateStats = Array.from(
    normalizedAssets.reduce((map, item) => {
      const stateName = String(item?.assetState?.name || "Sin estado").trim() || "Sin estado";
      const units = Math.max(Number(item?.quantity) || 0, 1);
      map.set(stateName, (map.get(stateName) || 0) + units);
      return map;
    }, new Map())
  ).sort((a, b) => b[1] - a[1]);
  const dependencyStats = Array.from(
    normalizedAssets.reduce((map, item) => {
      const dependencyName = String(item?.dependency?.name || "Sin sector").trim() || "Sin sector";
      const units = Math.max(Number(item?.quantity) || 0, 1);
      map.set(dependencyName, (map.get(dependencyName) || 0) + units);
      return map;
    }, new Map())
  ).sort((a, b) => b[1] - a[1]);
  const typeStats = Array.from(
    normalizedAssets.reduce((map, item) => {
      const typeName = String(item?.assetType?.name || "Sin tipo").trim() || "Sin tipo";
      const units = Math.max(Number(item?.quantity) || 0, 1);
      map.set(typeName, (map.get(typeName) || 0) + units);
      return map;
    }, new Map())
  ).sort((a, b) => b[1] - a[1]);
  const brandStats = Array.from(
    normalizedAssets.reduce((map, item) => {
      const brandName = String(item?.brand || "Sin marca").trim() || "Sin marca";
      const units = Math.max(Number(item?.quantity) || 0, 1);
      map.set(brandName, (map.get(brandName) || 0) + units);
      return map;
    }, new Map())
  ).sort((a, b) => b[1] - a[1]);
  const responsibleStats = Array.from(
    normalizedAssets.reduce((map, item) => {
      const responsibleName =
        String(item?.responsibleName || "Sin responsable").trim() || "Sin responsable";
      const units = Math.max(Number(item?.quantity) || 0, 1);
      map.set(responsibleName, (map.get(responsibleName) || 0) + units);
      return map;
    }, new Map())
  ).sort((a, b) => b[1] - a[1]);

  const headerTop = doc.page.margins.top + 2;
  const logoX = tableLeft;
  const logoY = headerTop;
  const logoWidth = 78;
  let logoBottom = headerTop;
  let titleBottom = headerTop;

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

  doc.font("Helvetica-Bold").fontSize(13.5).text("PLANCHETA DE INVENTARIO", tableLeft, headerTop + 2, {
    width: tableWidth,
    align: "center",
    underline: true,
  });
  titleBottom = doc.y;

  doc.font("Helvetica").fontSize(9.2);
  const headerLines = [
    `${meta.institution || getOfficialBrandName()} | ${meta.establishment || ""} | Sector: ${
      meta.dependency || "Todos"
    }`,
    `Rango: ${meta.dateRange || "Sin filtro"} | ${
      meta.ministryText || "Resumen de bienes verificados en el sector indicado."
    }`,
  ];
  let headerTextY = Math.max(titleBottom + 4, logoBottom + 10);
  headerLines.forEach((line) => {
    doc.text(line, tableLeft, headerTextY, { width: tableWidth, align: "left" });
    headerTextY = doc.y + 1;
  });

  doc.y += 8;
  doc.font("Helvetica").fontSize(7.2);

  const widths = PLANCHETA_PDF_COLUMN_WIDTHS;
  const tableGridWidth = widths.reduce((acc, width) => acc + width, 0);
  const tableGridLeft = tableLeft + Math.max(0, (tableWidth - tableGridWidth) / 2);
  const colX = [];
  let x = tableGridLeft;
  widths.forEach((w, idx) => {
    colX[idx] = x;
    x += w;
  });
  const headers = [
    "Codigo",
    "Caracteristicas basicas",
    "Unidad operativa",
    "Calidad Adm.",
    "Fecha",
  ];
  const printHeader = () => {
    const y = doc.y;
    const headerPadding = 3;
    doc.font("Helvetica-Bold");
    doc.fontSize(8);
    const headerHeights = headers.map((t, i) =>
      doc.heightOfString(String(t), { width: widths[i] - headerPadding * 2 })
    );
    const headerHeight = Math.max(
      15,
      ...headerHeights.map((height) => height + headerPadding * 2)
    );
    doc.rect(tableGridLeft, y, tableGridWidth, headerHeight).fill("#E9EFF6");
    headers.forEach((t, i) => {
      doc.rect(colX[i], y, widths[i], headerHeight).stroke("#AAB7C4");
      doc.fillColor("#14213D").text(t, colX[i] + headerPadding, y + headerPadding, {
        width: widths[i] - headerPadding * 2,
        height: headerHeight - headerPadding * 2,
      });
    });
    doc.fillColor("black");
    doc.y = y + headerHeight + 2;
    doc.font("Helvetica");
    doc.fontSize(7.2);
  };

  printHeader();

  normalizedAssets.forEach((a, index) => {
    const row = [
      toSingleLineCell(formatAssetCode(a.visibleCode || a.internalCode), PLANCHETA_PDF_CELL_LIMITS[0]),
      toSingleLineCell(buildAssetDescription(a, 86), PLANCHETA_PDF_CELL_LIMITS[1]),
      toSingleLineCell(a.dependency?.name || meta.operationalUnit || "", PLANCHETA_PDF_CELL_LIMITS[2]),
      toSingleLineCell(getAdministrativeQualityLabel(a), PLANCHETA_PDF_CELL_LIMITS[3]),
      toSingleLineCell(
        a.acquisitionDate ? new Date(a.acquisitionDate).toLocaleDateString("es-CL") : "-",
        PLANCHETA_PDF_CELL_LIMITS[4]
      ),
    ];
    const cellPadding = 2.5;
    const rowHeight = 18;

    if (doc.y + rowHeight > pageBottom() - 24) {
      doc.addPage();
      printHeader();
    }
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(tableGridLeft, y, tableGridWidth, rowHeight).fill("#F8FAFC");
    }
    doc.fillColor("black");

    row.forEach((v, i) => {
      doc.rect(colX[i], y, widths[i], rowHeight).stroke("#D5DDE5");
      doc.text(String(v ?? ""), colX[i] + cellPadding, y + cellPadding, {
        width: widths[i] - cellPadding * 2,
        height: rowHeight - cellPadding * 2,
        lineGap: 0,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.y = y + rowHeight + 1;
  });

  const totalLineY = doc.y + 6;
  if (totalLineY + 24 > pageBottom() - 16) {
    doc.addPage();
    printHeader();
  }
  doc
    .roundedRect(tableLeft, doc.y + 6, tableWidth, 20, 6)
    .fill("#E8F5E9")
    .stroke("#9DBA9D");
  doc.fillColor("#163020").font("Helvetica-Bold").fontSize(10).text(
    `TOTAL GENERAL: ${totalUnits} bienes en ${totalAssets} registros | Deprec anual: ${formatCurrency(totalAnnualDepreciation)}`,
    tableLeft + 12,
    doc.y + 12,
    { width: tableWidth - 24, align: "center" }
  );
  doc.fillColor("black");
  doc.y += 32;

  const stateLines = Math.max(1, stateStats.length);
  const dependencyLines = Math.max(1, Math.min(4, dependencyStats.length));
  const typeLines = Math.max(1, Math.min(4, typeStats.length));
  const legendLines = 1;
  const brandLines = Math.max(1, Math.min(4, brandStats.length));
  const responsibleLines = Math.max(1, Math.min(4, responsibleStats.length));
  const lowerBlockLines = Math.max(typeLines, brandLines, responsibleLines);
  const summaryHeight =
    122 + Math.max(stateLines, dependencyLines) * 18 + lowerBlockLines * 18 + legendLines * 16;
  if (doc.y + summaryHeight > pageBottom() - 16) {
    doc.addPage();
    printHeader();
  }
  const summaryY = doc.y + 8;
  doc.roundedRect(tableLeft, summaryY, tableWidth, summaryHeight - 14, 6).fill("#EEF6EE").stroke("#9DBA9D");
  doc.fillColor("#163020").font("Helvetica-Bold").fontSize(10).text("RESUMEN FINAL", tableLeft + 12, summaryY + 8);
  doc.font("Helvetica").fontSize(9.5);
  doc.text(`Total de registros: ${totalAssets}`, tableLeft + 12, summaryY + 22);
  doc.text(`Cantidad total de bienes: ${totalUnits}`, tableLeft + 220, summaryY + 22);
  const chartLeft = tableLeft + 12;
  const chartTop = summaryY + 42;
  const chartLabelWidth = 110;
  const chartBarWidth = 150;
  const chartValueX = chartLeft + chartLabelWidth + chartBarWidth + 12;
  const chartPctX = chartValueX + 42;
  const maxStateValue = Math.max(...stateStats.map(([, count]) => count), 1);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#163020").text("Por estado", chartLeft, chartTop - 14);
  stateStats.forEach(([stateName, count], idx) => {
    const y = chartTop + idx * 18;
    const barWidth = Math.max(10, Math.round((count / maxStateValue) * chartBarWidth));
    const pct = totalUnits > 0 ? Math.round((count / totalUnits) * 1000) / 10 : 0;
    const colors = getStateColor(stateName);
    doc.fillColor("#334155").fontSize(8.5).text(stateName, chartLeft, y, {
      width: chartLabelWidth - 8,
    });
    doc.rect(chartLeft + chartLabelWidth, y + 2, chartBarWidth, 9).stroke("#B8C4D0");
    doc.rect(chartLeft + chartLabelWidth, y + 2, barWidth, 9).fill(colors.fill);
    doc.fillColor(colors.text).text(String(count), chartValueX, y, { width: 36, align: "right" });
    doc.text(`${pct}%`, chartPctX, y, { width: 40, align: "right" });
  });
  const depLeft = tableLeft + tableWidth / 2 + 26;
  const depTop = chartTop;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#163020").text("Por sector", depLeft, depTop - 14);
  dependencyStats.slice(0, 4).forEach(([dependencyName, count], idx) => {
    const y = depTop + idx * 18;
    const pct = totalUnits > 0 ? Math.round((count / totalUnits) * 1000) / 10 : 0;
    doc.font("Helvetica").fillColor("#334155").text(dependencyName, depLeft, y, {
      width: 150,
      ellipsis: true,
    });
    doc.fillColor("#163020").text(String(count), depLeft + 188, y, {
      width: 34,
      align: "right",
    });
    doc.text(`${pct}%`, depLeft + 228, y, {
      width: 40,
      align: "right",
    });
  });
  if (dependencyStats.length > 4) {
    doc.fillColor("#64748B").text(`+${dependencyStats.length - 4} sectores más`, depLeft, depTop + 4 * 18, {
      width: 220,
    });
  }
  const secondRowTop = chartTop + Math.max(stateLines, dependencyLines) * 18 + 22;
  const typeLeft = chartLeft;
  const typeTop = secondRowTop;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#163020").text("Por tipo de activo", typeLeft, typeTop - 14);
  typeStats.slice(0, 4).forEach(([typeName, count], idx) => {
    const y = typeTop + idx * 18;
    const pct = totalUnits > 0 ? Math.round((count / totalUnits) * 1000) / 10 : 0;
    doc.font("Helvetica").fillColor("#334155").text(typeName, typeLeft, y, {
      width: 160,
      ellipsis: true,
    });
    doc.fillColor("#163020").text(String(count), typeLeft + 168, y, {
      width: 34,
      align: "right",
    });
    doc.text(`${pct}%`, typeLeft + 210, y, {
      width: 40,
      align: "right",
    });
  });
  if (typeStats.length > 4) {
    doc.fillColor("#64748B").text(`+${typeStats.length - 4} tipos más`, typeLeft, typeTop + 4 * 18, {
      width: 220,
    });
  }
  const brandLeft = tableLeft + tableWidth / 3 + 18;
  const brandTop = secondRowTop;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#163020").text("Por marca", brandLeft, brandTop - 14);
  brandStats.slice(0, 4).forEach(([brandName, count], idx) => {
    const y = brandTop + idx * 18;
    const pct = totalUnits > 0 ? Math.round((count / totalUnits) * 1000) / 10 : 0;
    doc.font("Helvetica").fillColor("#334155").text(brandName, brandLeft, y, {
      width: 150,
      ellipsis: true,
    });
    doc.fillColor("#163020").text(String(count), brandLeft + 158, y, {
      width: 30,
      align: "right",
    });
    doc.text(`${pct}%`, brandLeft + 196, y, {
      width: 38,
      align: "right",
    });
  });
  if (brandStats.length > 4) {
    doc.fillColor("#64748B").text(`+${brandStats.length - 4} marcas más`, brandLeft, brandTop + 4 * 18, {
      width: 220,
    });
  }
  const respLeft = tableLeft + (tableWidth * 2) / 3 + 24;
  const respTop = secondRowTop;
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#163020")
    .text("Por responsable", respLeft, respTop - 14);
  responsibleStats.slice(0, 4).forEach(([responsibleName, count], idx) => {
    const y = respTop + idx * 18;
    const pct = totalUnits > 0 ? Math.round((count / totalUnits) * 1000) / 10 : 0;
    doc.font("Helvetica").fillColor("#334155").text(responsibleName, respLeft, y, {
      width: 140,
      ellipsis: true,
    });
    doc.fillColor("#163020").text(String(count), respLeft + 148, y, {
      width: 28,
      align: "right",
    });
    doc.text(`${pct}%`, respLeft + 184, y, {
      width: 38,
      align: "right",
    });
  });
  if (responsibleStats.length > 4) {
    doc.fillColor("#64748B").text(
      `+${responsibleStats.length - 4} responsables más`,
      respLeft,
      respTop + 4 * 18,
      { width: 220 }
    );
  }
  const legendTop = summaryY + summaryHeight - 34;
  const legendItems = [
    { label: "Bueno", color: getStateColor("BUENO").fill },
    { label: "Baja", color: getStateColor("BAJA").fill },
    { label: "Malo/Critico", color: getStateColor("MALO").fill },
    { label: "Otros", color: getStateColor("OTRO").fill },
  ];
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#163020").text("Leyenda:", tableLeft + 12, legendTop);
  legendItems.forEach((item, idx) => {
    const x = tableLeft + 70 + idx * 120;
    doc.rect(x, legendTop + 1, 12, 8).fill(item.color).stroke("#94A3B8");
    doc.fillColor("#334155").font("Helvetica").text(item.label, x + 18, legendTop - 1, { width: 90 });
  });
  doc.fillColor("black");

  drawInsightsSection(doc, meta, tableLeft, tableWidth);

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(13).text("FIRMAS Y SELLO", { align: "center" });
  doc.moveDown(1.8);
  doc.font("Helvetica").fontSize(10);

  const blockTop = doc.y + 30;
  const signatureWidth = 250;
  const signatureGap = 36;
  const leftSignatureX = tableLeft + 60;
  const rightSignatureX = leftSignatureX + signatureWidth + signatureGap;
  const signatureLineY = blockTop + 42;

  doc.fontSize(9).fillColor("#475569");
  doc.text("Firma responsable", leftSignatureX, blockTop, {
    width: signatureWidth,
    align: "center",
  });
  doc.text("Firma jefatura", rightSignatureX, blockTop, {
    width: signatureWidth,
    align: "center",
  });

  doc.moveTo(leftSignatureX, signatureLineY).lineTo(leftSignatureX + signatureWidth, signatureLineY).stroke();
  doc.moveTo(rightSignatureX, signatureLineY).lineTo(rightSignatureX + signatureWidth, signatureLineY).stroke();

  doc.fillColor("black").fontSize(10);
  doc.text(meta.responsibleName || "Encargado de Sector", leftSignatureX, signatureLineY + 8, {
    width: signatureWidth,
    align: "center",
  });
  doc.text(meta.chiefName || "Jefe de Sector", rightSignatureX, signatureLineY + 8, {
    width: signatureWidth,
    align: "center",
  });

  doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(
    "El funcionario responsable debe velar por el buen uso, custodia y resguardo de los recursos asignados.",
    tableLeft + 20,
    signatureLineY + 28,
    { width: tableWidth - 40, align: "center" }
  );

  const sealWidth = 230;
  const sealHeight = 120;
  const sealX = tableLeft + (tableWidth - sealWidth) / 2;
  const sealY = signatureLineY + 78;
  doc.roundedRect(sealX, sealY, sealWidth, sealHeight, 8).stroke("#94A3B8");
  doc.font("Helvetica-Bold").fontSize(11).text("SELLO ESTABLECIMIENTO", sealX, sealY + 12, {
    width: sealWidth,
    align: "center",
  });
  doc.font("Helvetica").fontSize(9).fillColor("#64748B").text(
    "Espacio reservado para timbre y validacion institucional",
    sealX + 20,
    sealY + 40,
    { width: sealWidth - 40, align: "center" }
  );
  doc.fillColor("black");
  doc.fontSize(10);

  return doc;
}

module.exports = { buildPlanchetaPdf };
