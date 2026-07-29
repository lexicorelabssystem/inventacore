const express = require("express");
const router = express.Router();
const { getAuditLog } = require("../services/auditService");
const { listAssetAudits } = require("../services/assetAuditService");
const { exportAuditToExcel } = require("../services/auditExportExcelService");
const { exportAuditToPdf } = require("../services/auditExportPdfService");
const { authJwt } = require("../middleware/authJwt");
const { asyncHandler } = require("../utils/asyncHandler");
const { validateQuery } = require("../middleware/validate");
const { auditQuery } = require("../validators/auditSchemas");
const { assetAuditQuery } = require("../validators/assetAuditSchemas");

router.use(authJwt);

router.get(
  "/",
  validateQuery(auditQuery),
  asyncHandler(async (req, res) => {
    const filters = {
      assetId: req.query.assetId,
      userId: req.query.userId,
      type: req.query.type,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      q: req.query.q,
      take: req.query.take,
      skip: req.query.skip,
      sortOrder: req.query.sortOrder,
    };
    const result = await getAuditLog(filters, req.user);
    res.json(result);
  })
);

router.get(
  "/assets",
  validateQuery(assetAuditQuery),
  asyncHandler(async (req, res) => {
    const result = await listAssetAudits(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/export/excel",
  validateQuery(auditQuery),
  asyncHandler(async (req, res) => {
    const workbook = await exportAuditToExcel(req.query, req.user);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/export/pdf",
  validateQuery(auditQuery),
  asyncHandler(async (req, res) => {
    const doc = await exportAuditToPdf(req.query, req.user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit_${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.end();
  })
);

module.exports = { auditRouter: router };
