const ExcelJS = require("exceljs");
const { getOfficialBrandLogoBuffer } = require("../utils/officialBranding");
const { formatAssetCode } = require("../utils/assetCode");

function normalizeStateName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getStateStyle(stateName) {
  const normalized = normalizeStateName(stateName);
  if (normalized.includes("BUENO")) {
    return { fill: "FFE8F5E9", font: "FF1B5E20", label: "BUENO" };
  }
  if (normalized.includes("BAJA")) {
    return { fill: "FFF3F4F6", font: "FF374151", label: "BAJA" };
  }
  if (normalized.includes("MALO") || normalized.includes("CRIT")) {
    return { fill: "FFFFEBEE", font: "FFB71C1C", label: "MALO" };
  }
  return { fill: "FFEFF6FF", font: "FF1D4ED8", label: "OTRO" };
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
  const text = String(value || "").trim();
  if (!text) return "";
  if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1)).trim()}...`;
}

function extractPrimaryAssetName(asset) {
  const raw = String(asset?.name || "").trim();
  if (!raw) return "Activo";
  const firstPart = raw.split(/\s*-\s*/)[0];
  const normalized = String(firstPart || "").trim();
  return normalized || raw;
}

function buildAssetDescription(asset, maxLength = 120) {
  return truncateVisualText(extractPrimaryAssetName(asset), maxLength);
}

async function buildPlanchetaExcel(assets, meta) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plancheta");
  const normalizedAssets = Array.isArray(assets) ? assets : [];
  const totalAssets = normalizedAssets.length;
  const totalUnits = normalizedAssets.reduce(
    (acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1),
    0
  );
  const totalAcquisitionValue = normalizedAssets.reduce(
    (acc, item) => acc + Math.max(Number(item?.acquisitionValue) || 0, 0),
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
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
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

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "PLANCHETA DE INVENTARIO";
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
  sheet.addRow(["Fecha:", new Date().toLocaleDateString("es-CL")]);
  const responsibilityRow = sheet.addRow([
    "Responsabilidad:",
    "El funcionario responsable debe velar por el buen uso, custodia y resguardo de los recursos asignados.",
  ]);
  sheet.mergeCells(`B${responsibilityRow.number}:E${responsibilityRow.number}`);
  sheet.getCell(`A${responsibilityRow.number}`).font = {
    bold: true,
    color: { argb: "FF1B4332" },
  };
  sheet.getCell(`A${responsibilityRow.number}`).alignment = {
    vertical: "middle",
  };
  sheet.getCell(`B${responsibilityRow.number}`).font = {
    italic: true,
    color: { argb: "FF475569" },
  };
  sheet.getCell(`B${responsibilityRow.number}`).alignment = {
    vertical: "middle",
    wrapText: true,
  };

  sheet.addRow([]);

  sheet.addRow([
    "Codigo",
    "Caracteristicas basicas",
    "Unidad operativa",
    "Calidad Adm.",
    "Fecha",
  ]);

  const headerRow = sheet.getRow(sheet.lastRow.number);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2D6A4F" },
  };

  normalizedAssets.forEach((a) => {
    sheet.addRow([
      formatAssetCode(a.visibleCode || a.internalCode),
      buildAssetDescription(a, 118),
      a.dependency?.name || "",
      getAdministrativeQualityLabel(a),
      a.acquisitionDate ? new Date(a.acquisitionDate) : "",
    ]);
  });

  sheet.addRow([]);
  const totalRow = sheet.addRow([
    "TOTAL GENERAL",
    `Bienes: ${totalUnits}`,
    "",
    `Registros: ${totalAssets}`,
    `Valor adq: $${Math.round(totalAcquisitionValue).toLocaleString("es-CL")}`,
  ]);
  sheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
  totalRow.font = { bold: true };
  ["A", "B", "C", "D", "E"].forEach((col) => {
    const cell = sheet.getCell(`${col}${totalRow.number}`);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9DBA9D" } },
      left: { style: "thin", color: { argb: "FF9DBA9D" } },
      bottom: { style: "thin", color: { argb: "FF9DBA9D" } },
      right: { style: "thin", color: { argb: "FF9DBA9D" } },
    };
  });

  sheet.addRow([]);
  const summaryRow = sheet.addRow([
    "RESUMEN FINAL",
    `Total de registros: ${totalAssets}`,
    "",
    `Cantidad total de bienes: ${totalUnits}`,
    `Deprec anual total: $${Math.round(totalAnnualDepreciation).toLocaleString("es-CL")}`,
  ]);
  sheet.mergeCells(`A${summaryRow.number}:B${summaryRow.number}`);
  summaryRow.font = { bold: true };
  summaryRow.alignment = { vertical: "middle" };
  ["A", "B", "C", "D", "E"].forEach((col) => {
    const cell = sheet.getCell(`${col}${summaryRow.number}`);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF6EE" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9DBA9D" } },
      left: { style: "thin", color: { argb: "FF9DBA9D" } },
      bottom: { style: "thin", color: { argb: "FF9DBA9D" } },
      right: { style: "thin", color: { argb: "FF9DBA9D" } },
    };
  });

  if (stateStats.length) {
    sheet.addRow([]);
    const stateHeader = sheet.addRow(["RESUMEN POR ESTADO", "Cantidad", "Porcentaje", "Grafico"]);
    [1, 2, 3, 4].forEach((col) => {
      const cell = stateHeader.getCell(col);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3A5A40" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF9DBA9D" } },
        left: { style: "thin", color: { argb: "FF9DBA9D" } },
        bottom: { style: "thin", color: { argb: "FF9DBA9D" } },
        right: { style: "thin", color: { argb: "FF9DBA9D" } },
      };
    });

    stateStats.forEach(([stateName, count], idx) => {
      const pct = totalUnits > 0 ? count / totalUnits : 0;
      const bars = "#".repeat(Math.max(1, Math.round(pct * 20)));
      const row = sheet.addRow([stateName, count, pct, bars]);
      row.getCell(3).numFmt = "0.0%";
      const stateStyle = getStateStyle(stateName);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD6E2D6" } },
          left: { style: "thin", color: { argb: "FFD6E2D6" } },
          bottom: { style: "thin", color: { argb: "FFD6E2D6" } },
          right: { style: "thin", color: { argb: "FFD6E2D6" } },
        };
        if (idx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FBF8" },
          };
        }
      });
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: stateStyle.fill },
      };
      row.getCell(1).font = { color: { argb: stateStyle.font }, bold: true };
    });
  }

  if (dependencyStats.length) {
    sheet.addRow([]);
    const depHeader = sheet.addRow(["RESUMEN POR DEPENDENCIA", "Cantidad", "Porcentaje"]);
    [1, 2, 3].forEach((col) => {
      const cell = depHeader.getCell(col);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF344E41" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFB7C7B7" } },
        left: { style: "thin", color: { argb: "FFB7C7B7" } },
        bottom: { style: "thin", color: { argb: "FFB7C7B7" } },
        right: { style: "thin", color: { argb: "FFB7C7B7" } },
      };
    });

    dependencyStats.forEach(([dependencyName, count], idx) => {
      const pct = totalUnits > 0 ? count / totalUnits : 0;
      const row = sheet.addRow([dependencyName, count, pct]);
      row.getCell(3).numFmt = "0.0%";
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE1E8E1" } },
          left: { style: "thin", color: { argb: "FFE1E8E1" } },
          bottom: { style: "thin", color: { argb: "FFE1E8E1" } },
          right: { style: "thin", color: { argb: "FFE1E8E1" } },
        };
        if (idx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFAFCFA" },
          };
        }
      });
    });
  }

  if (typeStats.length) {
    sheet.addRow([]);
    const typeHeader = sheet.addRow(["RESUMEN POR TIPO DE ACTIVO", "Cantidad", "Porcentaje"]);
    [1, 2, 3].forEach((col) => {
      const cell = typeHeader.getCell(col);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4A5568" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFC7D0DB" } },
        left: { style: "thin", color: { argb: "FFC7D0DB" } },
        bottom: { style: "thin", color: { argb: "FFC7D0DB" } },
        right: { style: "thin", color: { argb: "FFC7D0DB" } },
      };
    });

    typeStats.forEach(([typeName, count], idx) => {
      const pct = totalUnits > 0 ? count / totalUnits : 0;
      const row = sheet.addRow([typeName, count, pct]);
      row.getCell(3).numFmt = "0.0%";
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE3E8EF" } },
          left: { style: "thin", color: { argb: "FFE3E8EF" } },
          bottom: { style: "thin", color: { argb: "FFE3E8EF" } },
          right: { style: "thin", color: { argb: "FFE3E8EF" } },
        };
        if (idx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }
      });
    });
  }

  if (brandStats.length) {
    sheet.addRow([]);
    const brandHeader = sheet.addRow(["RESUMEN POR MARCA", "Cantidad", "Porcentaje"]);
    [1, 2, 3].forEach((col) => {
      const cell = brandHeader.getCell(col);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6B705C" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD6D3C9" } },
        left: { style: "thin", color: { argb: "FFD6D3C9" } },
        bottom: { style: "thin", color: { argb: "FFD6D3C9" } },
        right: { style: "thin", color: { argb: "FFD6D3C9" } },
      };
    });

    brandStats.forEach(([brandName, count], idx) => {
      const pct = totalUnits > 0 ? count / totalUnits : 0;
      const row = sheet.addRow([brandName, count, pct]);
      row.getCell(3).numFmt = "0.0%";
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE8E5DD" } },
          left: { style: "thin", color: { argb: "FFE8E5DD" } },
          bottom: { style: "thin", color: { argb: "FFE8E5DD" } },
          right: { style: "thin", color: { argb: "FFE8E5DD" } },
        };
        if (idx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFBFAF7" },
          };
        }
      });
    });
  }

  if (responsibleStats.length) {
    sheet.addRow([]);
    const responsibleHeader = sheet.addRow(["RESUMEN POR RESPONSABLE", "Cantidad", "Porcentaje"]);
    [1, 2, 3].forEach((col) => {
      const cell = responsibleHeader.getCell(col);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF5A189A" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDAC8F0" } },
        left: { style: "thin", color: { argb: "FFDAC8F0" } },
        bottom: { style: "thin", color: { argb: "FFDAC8F0" } },
        right: { style: "thin", color: { argb: "FFDAC8F0" } },
      };
    });

    responsibleStats.forEach(([responsibleName, count], idx) => {
      const pct = totalUnits > 0 ? count / totalUnits : 0;
      const row = sheet.addRow([responsibleName, count, pct]);
      row.getCell(3).numFmt = "0.0%";
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFECDDFA" } },
          left: { style: "thin", color: { argb: "FFECDDFA" } },
          bottom: { style: "thin", color: { argb: "FFECDDFA" } },
          right: { style: "thin", color: { argb: "FFECDDFA" } },
        };
        if (idx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFBF7FF" },
          };
        }
      });
    });
  }

  sheet.addRow([]);
  const signatureLineRow = sheet.addRow([]);
  const signatureNameRow = sheet.addRow([]);
  const signatureHintRow = sheet.addRow([]);
  sheet.addRow([]);

  sheet.mergeCells(`A${signatureLineRow.number}:C${signatureLineRow.number}`);
  sheet.mergeCells(`D${signatureLineRow.number}:F${signatureLineRow.number}`);
  sheet.getCell(`A${signatureLineRow.number}`).border = {
    bottom: { style: "thin", color: { argb: "FF475569" } },
  };
  sheet.getCell(`D${signatureLineRow.number}`).border = {
    bottom: { style: "thin", color: { argb: "FF475569" } },
  };

  sheet.mergeCells(`A${signatureNameRow.number}:C${signatureNameRow.number}`);
  sheet.mergeCells(`D${signatureNameRow.number}:F${signatureNameRow.number}`);
  sheet.getCell(`A${signatureNameRow.number}`).value =
    meta.responsibleName || "Encargado de Sector";
  sheet.getCell(`D${signatureNameRow.number}`).value = meta.chiefName || "Jefe de Sector";
  sheet.getCell(`A${signatureNameRow.number}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  sheet.getCell(`D${signatureNameRow.number}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  sheet.mergeCells(`A${signatureHintRow.number}:C${signatureHintRow.number}`);
  sheet.mergeCells(`D${signatureHintRow.number}:F${signatureHintRow.number}`);
  sheet.getCell(`A${signatureHintRow.number}`).value = "Firma responsable";
  sheet.getCell(`D${signatureHintRow.number}`).value = "Firma jefatura";
  sheet.getCell(`A${signatureHintRow.number}`).font = { italic: true, color: { argb: "FF64748B" } };
  sheet.getCell(`D${signatureHintRow.number}`).font = { italic: true, color: { argb: "FF64748B" } };
  sheet.getCell(`A${signatureHintRow.number}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  sheet.getCell(`D${signatureHintRow.number}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  const sealStart = sheet.lastRow.number + 1;
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.mergeCells(`B${sealStart}:E${sealStart + 2}`);
  sheet.getCell(`B${sealStart}`).value = "SELLO ESTABLECIMIENTO";
  sheet.getCell(`B${sealStart}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`B${sealStart}`).font = { bold: true };
  sheet.getCell(`B${sealStart}`).border = {
    top: { style: "thin", color: { argb: "FF94A3B8" } },
    left: { style: "thin", color: { argb: "FF94A3B8" } },
    bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    right: { style: "thin", color: { argb: "FF94A3B8" } },
  };

  const widths = [18, 52, 30, 18, 14];
  for (let i = 1; i <= widths.length; i++) {
    const col = sheet.getColumn(i);
    col.width = widths[i - 1];
    col.alignment = { vertical: "top", wrapText: true };
  }
  sheet.getColumn(5).numFmt = "dd/mm/yyyy";

  const zebraFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF7F9FC" },
  };
  const firstDataRow = headerRow.number + 1;
  const lastDataRow = firstDataRow + Math.max(normalizedAssets.length - 1, -1);
  sheet.views = [{ state: "frozen", ySplit: headerRow.number }];
  headerRow.height = 24;

  for (let rowIndex = firstDataRow; rowIndex <= lastDataRow; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    row.height = Math.max(row.height || 0, 36);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFBFBF" } },
        left: { style: "thin", color: { argb: "FFBFBFBF" } },
        bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
        right: { style: "thin", color: { argb: "FFBFBFBF" } },
      };
    });
    if (rowIndex % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = zebraFill;
      });
    }
  }

  return workbook;
}

module.exports = { buildPlanchetaExcel };
