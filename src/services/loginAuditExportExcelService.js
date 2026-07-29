const ExcelJS = require("exceljs");
const { listLoginAudits } = require("./loginAuditQueryService");

async function exportLoginAuditToExcel(query, user) {
  const { items } = await listLoginAudits(
    { ...query, take: 10000, skip: 0 },
    user
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("LoginAudit");

  sheet.columns = [
    { header: "Fecha", key: "createdAt", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Usuario", key: "userName", width: 25 },
    { header: "UserId", key: "userId", width: 10 },
    { header: "IP", key: "ip", width: 16 },
    { header: "Success", key: "success", width: 10 },
    { header: "Reason", key: "reason", width: 20 },
  ];

  items.forEach((a) => {
    sheet.addRow({
      createdAt: a.createdAt.toISOString(),
      email: a.email,
      userName: a.user?.name || "",
      userId: a.userId || "",
      ip: a.ip,
      success: a.success ? "YES" : "NO",
      reason: a.reason || "",
    });
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  };

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  sheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm";

  return workbook;
}

module.exports = { exportLoginAuditToExcel };
