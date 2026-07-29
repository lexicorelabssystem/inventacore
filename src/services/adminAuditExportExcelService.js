const ExcelJS = require("exceljs");
const { listAdminAudits } = require("./adminAuditService");

async function exportAdminAuditToExcel(query, user) {
  const { items } = await listAdminAudits(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AdminAudit");

  sheet.columns = [
    { header: "Fecha", key: "createdAt", width: 20 },
    { header: "Entidad", key: "entityType", width: 16 },
    { header: "Accion", key: "action", width: 12 },
    { header: "EntityId", key: "entityId", width: 12 },
    { header: "Usuario", key: "userName", width: 25 },
    { header: "Email", key: "userEmail", width: 30 },
  ];

  items.forEach((a) => {
    sheet.addRow({
      createdAt: a.createdAt.toISOString(),
      entityType: a.entityType,
      action: a.action,
      entityId: a.entityId,
      userName: a.user?.name || "",
      userEmail: a.user?.email || "",
    });
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4A235A" },
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

  return workbook;
}

module.exports = { exportAdminAuditToExcel };
