const ExcelJS = require("exceljs");
const { getAuditLog } = require("./auditService");

async function exportAuditToExcel(query, user) {
  const { items } = await getAuditLog(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Audit");

  sheet.columns = [
    { header: "Fecha", key: "createdAt", width: 20 },
    { header: "Tipo", key: "type", width: 15 },
    { header: "Codigo", key: "internalCode", width: 15 },
    { header: "Asset", key: "assetName", width: 30 },
    { header: "Usuario", key: "userName", width: 25 },
    { header: "Email", key: "userEmail", width: 30 },
    { header: "Desde", key: "fromDependency", width: 25 },
    { header: "Hacia", key: "toDependency", width: 25 },
  ];

  items.forEach((m) => {
    sheet.addRow({
      createdAt: m.createdAt.toISOString(),
      type: m.type,
      internalCode: m.asset?.internalCode || "",
      assetName: m.asset?.name || "",
      userName: m.user?.name || "",
      userEmail: m.user?.email || "",
      fromDependency: m.fromDependency?.name || "",
      toDependency: m.toDependency?.name || "",
    });
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2F5597" },
  };

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  sheet.columns.forEach((col) => {
    col.alignment = { vertical: "middle", wrapText: true };
    col.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  });

  sheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm";

  // Zebra rows
  const zebraFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF7F9FC" },
  };
  for (let rowIndex = 2; rowIndex <= sheet.lastRow.number; rowIndex++) {
    if (rowIndex % 2 === 0) {
      sheet.getRow(rowIndex).eachCell((cell) => {
        cell.fill = zebraFill;
      });
    }
  }

  return workbook;
}

module.exports = { exportAuditToExcel };
