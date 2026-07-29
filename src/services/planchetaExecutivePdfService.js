const PDFDocument = require("pdfkit");

function normLabel(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function summarizeAssets(assets) {
  const items = Array.isArray(assets) ? assets : [];
  const totalAssets = items.length;
  const totalUnits = items.reduce((acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1), 0);
  const totalValue = items.reduce(
    (acc, item) => acc + Math.max(Number(item?.acquisitionValue) || 0, 0),
    0
  );
  const totalAnnualDepreciation = items.reduce(
    (acc, item) => acc + Math.max(Number(item?.depreciationAnnualValue) || 0, 0),
    0
  );

  const aggregate = (picker, fallback) =>
    Array.from(
      items.reduce((map, item) => {
        const key = normLabel(picker(item), fallback);
        const units = Math.max(Number(item?.quantity) || 0, 1);
        map.set(key, (map.get(key) || 0) + units);
        return map;
      }, new Map())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

  return {
    totalAssets,
    totalUnits,
    totalValue,
    totalAnnualDepreciation,
    states: aggregate((item) => item?.assetState?.name, "Sin estado"),
    dependencies: aggregate((item) => item?.dependency?.name, "Sin sector"),
    types: aggregate((item) => item?.assetType?.name, "Sin tipo"),
    brands: aggregate((item) => item?.brand, "Sin marca"),
    responsibles: aggregate((item) => item?.responsibleName, "Sin responsable"),
  };
}

function barColor(label) {
  const normalized = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (normalized.includes("BUENO")) return "#2D6A4F";
  if (normalized.includes("BAJA")) return "#6B7280";
  if (normalized.includes("MALO") || normalized.includes("CRIT")) return "#C1121F";
  return "#2563EB";
}

function drawMetricCard(doc, x, y, w, h, title, value, note) {
  doc.roundedRect(x, y, w, h, 10).fill("#F8FAFC").stroke("#CBD5E1");
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(9).text(title, x + 12, y + 10);
  doc.fillColor("#0F172A").fontSize(18).text(String(value), x + 12, y + 26, { width: w - 24 });
  if (note) {
    doc.fillColor("#64748B").font("Helvetica").fontSize(8).text(note, x + 12, y + h - 18, {
      width: w - 24,
    });
  }
}

function drawRankTable(doc, opts) {
  const { x, y, width, title, rows, totalUnits, coloredBars = false } = opts;
  doc.roundedRect(x, y, width, 138, 8).fill("#FFFFFF").stroke("#D7DEE7");
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(9).text(title, x + 10, y + 8);
  const startY = y + 28;
  const labelW = width - 88;
  const barW = 54;
  rows.slice(0, 5).forEach(([label, count], idx) => {
    const rowY = startY + idx * 20;
    const pct = totalUnits > 0 ? Math.round((count / totalUnits) * 1000) / 10 : 0;
    doc.fillColor("#334155").font("Helvetica").fontSize(8).text(label, x + 10, rowY, {
      width: labelW - 8,
      ellipsis: true,
    });
    doc.rect(x + labelW, rowY + 2, barW, 8).stroke("#CBD5E1");
    const fillWidth = Math.max(8, Math.round((pct / 100) * barW));
    doc.rect(x + labelW, rowY + 2, fillWidth, 8).fill(coloredBars ? barColor(label) : "#3B82F6");
    doc.fillColor("#0F172A").text(`${count} / ${pct}%`, x + labelW + barW + 4, rowY, {
      width: 34,
      align: "right",
    });
  });
}

function drawExecutiveInsightsPage(doc, meta) {
  const insights = meta?.insights;
  if (!insights) return;
  doc.addPage();
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const weeklyUnits = Number(insights?.weekly?.units || 0);
  const monthlyUnits = Number(insights?.monthly?.units || 0);
  const maxUnits = Math.max(weeklyUnits, monthlyUnits, 1);
  const stateOverview = Array.isArray(insights?.stateOverview) ? insights.stateOverview : [];
  const monthlyCategories = Array.isArray(insights?.monthly?.byCategory)
    ? insights.monthly.byCategory
    : [];

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(16).text("RESUMEN DE BAJAS Y ESTADOS", left, 34);
  doc.fillColor("#475569").font("Helvetica").fontSize(9).text(
    "Resumen semanal y mensual de activos dados de baja, con distribucion actual por estado.",
    left,
    56,
    { width: pageWidth }
  );

  drawMetricCard(doc, left, 90, (pageWidth - 24) / 3, 76, "Bajas 7 dias", insights?.weekly?.count || 0, `${weeklyUnits} bienes`);
  drawMetricCard(doc, left + (pageWidth - 24) / 3 + 12, 90, (pageWidth - 24) / 3, 76, "Bajas 30 dias", insights?.monthly?.count || 0, `${monthlyUnits} bienes`);
  drawMetricCard(
    doc,
    left + ((pageWidth - 24) / 3 + 12) * 2,
    90,
    (pageWidth - 24) / 3,
    76,
    "Activos sin responsable",
    insights?.recommendations?.withoutResponsible || 0,
    "Regularizar custodia"
  );

  const chartY = 192;
  doc.roundedRect(left, chartY, pageWidth, 118, 10).fill("#F8FAFC").stroke("#CBD5E1");
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(10).text("Grafico comparativo de bajas", left + 12, chartY + 10);
  const chartLeft = left + 18;
  const barBaseY = chartY + 88;
  const barMaxHeight = 44;
  const weeklyBarHeight = Math.max(10, Math.round((weeklyUnits / maxUnits) * barMaxHeight));
  const monthlyBarHeight = Math.max(10, Math.round((monthlyUnits / maxUnits) * barMaxHeight));
  doc.fillColor("#64748B").rect(chartLeft + 34, barBaseY - weeklyBarHeight, 54, weeklyBarHeight).fill();
  doc.fillColor("#1D4ED8").rect(chartLeft + 132, barBaseY - monthlyBarHeight, 54, monthlyBarHeight).fill();
  doc.fillColor("#334155").font("Helvetica").fontSize(8.5).text("Semanal", chartLeft + 28, barBaseY + 8, { width: 68, align: "center" });
  doc.text("Mensual", chartLeft + 126, barBaseY + 8, { width: 68, align: "center" });
  doc.fillColor("#0F172A").text(String(weeklyUnits), chartLeft + 28, barBaseY - weeklyBarHeight - 16, { width: 68, align: "center" });
  doc.text(String(monthlyUnits), chartLeft + 126, barBaseY - monthlyBarHeight - 16, { width: 68, align: "center" });

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(9).text("Categorias con mas bajas (30 dias)", left + 260, chartY + 18);
  monthlyCategories.slice(0, 5).forEach((row, idx) => {
    const y = chartY + 42 + idx * 14;
    doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(row.label, left + 260, y, {
      width: 180,
      ellipsis: true,
    });
    doc.fillColor("#0F172A").text(String(row.count), left + 452, y, { width: 30, align: "right" });
  });

  if (stateOverview.length) {
    doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(9).text("Estados actuales (incluye baja)", left + 510, chartY + 18);
    stateOverview.slice(0, 5).forEach((row, idx) => {
      const y = chartY + 42 + idx * 14;
      doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(String(row.label || "Sin estado"), left + 510, y, {
        width: 130,
        ellipsis: true,
      });
      doc.fillColor(barColor(row.label)).rect(left + 646, y + 2, 10, 8).fill();
      doc.fillColor("#0F172A").text(String(row.count || 0), left + 662, y, { width: 24, align: "right" });
    });
  }

  doc.fillColor("black");
}

function buildPlanchetaExecutivePdf(assets, meta) {
  const summary = summarizeAssets(assets);
  const doc = new PDFDocument({ margin: 32, size: "A4" });
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(18).text("PLANCHETA GERENCIAL", left, 34);
  doc.fillColor("#475569").font("Helvetica").fontSize(9).text(
    `${meta.institution || ""} | ${meta.establishment || ""} | Sector: ${meta.dependency || "Todos"}`,
    left,
    58,
    { width: pageWidth }
  );
  doc.text(
    `Rango: ${meta.dateRange || "Sin filtro"} | ${
      meta.ministryText || "Resumen de bienes verificados en el sector indicado."
    }`,
    left,
    72,
    { width: pageWidth }
  );

  const cardY = 116;
  const gap = 12;
  const cardW = (pageWidth - gap * 3) / 4;
  drawMetricCard(doc, left, cardY, cardW, 76, "Registros", summary.totalAssets, "Activos listados");
  drawMetricCard(doc, left + cardW + gap, cardY, cardW, 76, "Bienes", summary.totalUnits, "Cantidad total");
  drawMetricCard(
    doc,
    left + (cardW + gap) * 2,
    cardY,
    cardW,
    76,
    "Valor Referencial",
    `$${Math.round(summary.totalValue).toLocaleString("es-CL")}`,
    "Suma de adquisición"
  );

  drawMetricCard(
    doc,
    left + (cardW + gap) * 3,
    cardY,
    cardW,
    76,
    "Deprec. Anual",
    `$${Math.round(summary.totalAnnualDepreciation).toLocaleString("es-CL")}`,
    "Suma anual estimada"
  );

  const sectionY = cardY + 96;
  const colGap = 12;
  const colW = (pageWidth - colGap) / 2;
  drawRankTable(doc, {
    x: left,
    y: sectionY,
    width: colW,
    title: "Estados",
    rows: summary.states,
    totalUnits: summary.totalUnits,
    coloredBars: true,
  });
  drawRankTable(doc, {
    x: left + colW + colGap,
    y: sectionY,
    width: colW,
    title: "Sectores",
    rows: summary.dependencies,
    totalUnits: summary.totalUnits,
  });

  const secondY = sectionY + 156;
  drawRankTable(doc, {
    x: left,
    y: secondY,
    width: colW,
    title: "Tipos de Activo",
    rows: summary.types,
    totalUnits: summary.totalUnits,
  });
  drawRankTable(doc, {
    x: left + colW + colGap,
    y: secondY,
    width: colW,
    title: "Marcas",
    rows: summary.brands,
    totalUnits: summary.totalUnits,
  });

  const thirdY = secondY + 156;
  drawRankTable(doc, {
    x: left,
    y: thirdY,
    width: pageWidth,
    title: "Responsables",
    rows: summary.responsibles,
    totalUnits: summary.totalUnits,
  });

  doc.fillColor("#64748B").font("Helvetica").fontSize(8).text(
    "Leyenda visual: verde=bueno, gris=baja, rojo=malo/critico, azul=otros.",
    left,
    doc.page.height - 42,
    { width: pageWidth, align: "center" }
  );

  drawExecutiveInsightsPage(doc, meta);

  return doc;
}

module.exports = { buildPlanchetaExecutivePdf };
