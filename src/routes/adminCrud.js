const express = require("express");
const router = express.Router();

const { authJwt } = require("../middleware/authJwt");
const { asyncHandler } = require("../utils/asyncHandler");
const { validateBody, validateParams, validateQuery } = require("../middleware/validate");
const { requireJson } = require("../middleware/requireJson");
const {
  pagination,
  establishmentsQuery,
  dependenciesQuery,
  adminAuditQuery,
  loginAuditQuery,
  auditCleanupBody,
  usersQuery,
  idParam,
  forceDeleteBody,
  institutionCreate,
  institutionUpdate,
  establishmentCreate,
  establishmentUpdate,
  establishmentBulkCreate,
  dependencyCreate,
  dependencyUpdate,
  dependencyBulkCreate,
  dependencyReplicateBody,
  catalogItemsQuery,
  catalogItemCreate,
  catalogItemUpdate,
  catalogItemBulkCreate,
  officialKeyAvailabilityQuery,
  userCreate,
  userUpdate,
  userResetPasswordBody,
  supportAskBody,
  supportRequestCreate,
  supportRequestQuery,
  supportRequestStatusUpdate,
  supportRequestCommentCreate,
  supportEmailTestBody,
} = require("../validators/adminCrudSchemas");

const {
  listInstitutions,
  getInstitution,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  reactivateInstitution,
  deleteInstitutionPermanent,
  getInstitutionForceDeleteSummary,
  deleteInstitutionPermanentForce,
} = require("../services/institutionAdminService");

const {
  listEstablishments,
  getEstablishment,
  createEstablishment,
  updateEstablishment,
  deleteEstablishment,
  reactivateEstablishment,
  deleteEstablishmentPermanent,
  getEstablishmentForceDeleteSummary,
  deleteEstablishmentPermanentForce,
  createEstablishmentsBulk,
} = require("../services/establishmentAdminService");

const {
  listDependencies,
  getDependency,
  createDependency,
  updateDependency,
  deleteDependency,
  reactivateDependency,
  deleteDependencyPermanent,
  getDependencyForceDeleteSummary,
  deleteDependencyPermanentForce,
  createDependenciesBulk,
  replicateDependencies,
} = require("../services/dependencyAdminService");

const {
  listCatalogItems,
  getCatalogItem,
  checkOfficialKeyAvailability,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogItemForceDeleteSummary,
  deleteCatalogItemPermanentForce,
  purgeCatalogAndResetSequence,
  createCatalogItemsBulk,
  buildCatalogItemsImportTemplate,
  importCatalogItemsFromExcel,
} = require("../services/catalogItemAdminService");
const {
  createUser,
  listUsers,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  getUserForceDeleteSummary,
  deleteUserPermanentForce,
  setUserPhoto,
  clearUserPhoto,
} = require("../services/userAdminService");
const {
  askAssistant,
  createSupportRequest,
  listSupportRequests,
  updateSupportRequestStatus,
  addSupportRequestComment,
  testSupportSmtp,
} = require("../services/supportAssistantService");
const multer = require("multer");

const { listAdminAudits } = require("../services/adminAuditService");
const { cleanupAudits } = require("../services/auditCleanupService");
const { exportAdminAuditToExcel } = require("../services/adminAuditExportExcelService");
const { exportAdminAuditToPdf } = require("../services/adminAuditExportPdfService");
const { listLoginAudits } = require("../services/loginAuditQueryService");
const { exportLoginAuditToExcel } = require("../services/loginAuditExportExcelService");
const { exportLoginAuditToPdf } = require("../services/loginAuditExportPdfService");
const {
  getLoginAuditMetrics,
  getLoginAuditMetricsHourly,
  getLoginAuditMetricsByIp,
  getLoginAuditMetricsByUser,
} = require("../services/loginAuditMetricsService");
const {
  exportLoginMetricsHourlyPdf,
  exportLoginMetricsIpPdf,
  exportLoginMetricsUserPdf,
} = require("../services/loginAuditMetricsExportPdfService");
const {
  exportInstitutions,
  exportEstablishments,
  exportDependencies,
} = require("../services/adminCrudExportService");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const uploadUserPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
const { sendError } = require("../utils/errorResponse");

router.use(authJwt);

// Institutions
router.get(
  "/institutions",
  validateQuery(pagination),
  asyncHandler(async (req, res) => {
    const result = await listInstitutions(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/institutions/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getInstitution(req.params.id, req.user);
    res.json(item);
  })
);

router.post(
  "/institutions",
  requireJson,
  validateBody(institutionCreate),
  asyncHandler(async (req, res) => {
    const item = await createInstitution(req.body, req.user);
    res.status(201).json(item);
  })
);

router.put(
  "/institutions/:id",
  validateParams(idParam),
  requireJson,
  validateBody(institutionUpdate),
  asyncHandler(async (req, res) => {
    const item = await updateInstitution(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.delete(
  "/institutions/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteInstitution(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/institutions/:id/permanent",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteInstitutionPermanent(req.params.id, req.user);
    res.json(item);
  })
);

router.get(
  "/institutions/:id/permanent/summary",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getInstitutionForceDeleteSummary(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/institutions/:id/permanent/force",
  validateParams(idParam),
  requireJson,
  validateBody(forceDeleteBody),
  asyncHandler(async (req, res) => {
    const item = await deleteInstitutionPermanentForce(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.put(
  "/institutions/:id/reactivate",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await reactivateInstitution(req.params.id, req.user);
    res.json(item);
  })
);

// Establishments
router.get(
  "/establishments",
  validateQuery(establishmentsQuery),
  asyncHandler(async (req, res) => {
    const result = await listEstablishments(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/establishments/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getEstablishment(req.params.id, req.user);
    res.json(item);
  })
);

router.post(
  "/establishments",
  requireJson,
  validateBody(establishmentCreate),
  asyncHandler(async (req, res) => {
    const item = await createEstablishment(req.body, req.user);
    res.status(201).json(item);
  })
);

router.post(
  "/establishments/bulk",
  requireJson,
  validateBody(establishmentBulkCreate),
  asyncHandler(async (req, res) => {
    const result = await createEstablishmentsBulk(req.body, req.user);
    res.status(201).json(result);
  })
);

router.put(
  "/establishments/:id",
  validateParams(idParam),
  requireJson,
  validateBody(establishmentUpdate),
  asyncHandler(async (req, res) => {
    const item = await updateEstablishment(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.delete(
  "/establishments/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteEstablishment(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/establishments/:id/permanent",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteEstablishmentPermanent(req.params.id, req.user);
    res.json(item);
  })
);

router.get(
  "/establishments/:id/permanent/summary",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getEstablishmentForceDeleteSummary(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/establishments/:id/permanent/force",
  validateParams(idParam),
  requireJson,
  validateBody(forceDeleteBody),
  asyncHandler(async (req, res) => {
    const item = await deleteEstablishmentPermanentForce(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.put(
  "/establishments/:id/reactivate",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await reactivateEstablishment(req.params.id, req.user);
    res.json(item);
  })
);

// Dependencies
router.get(
  "/dependencies",
  validateQuery(dependenciesQuery),
  asyncHandler(async (req, res) => {
    const result = await listDependencies(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/dependencies/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getDependency(req.params.id, req.user);
    res.json(item);
  })
);

router.post(
  "/dependencies",
  requireJson,
  validateBody(dependencyCreate),
  asyncHandler(async (req, res) => {
    const item = await createDependency(req.body, req.user);
    res.status(201).json(item);
  })
);

router.post(
  "/dependencies/bulk",
  requireJson,
  validateBody(dependencyBulkCreate),
  asyncHandler(async (req, res) => {
    const result = await createDependenciesBulk(req.body, req.user);
    res.status(201).json(result);
  })
);

router.post(
  "/dependencies/replicate",
  requireJson,
  validateBody(dependencyReplicateBody),
  asyncHandler(async (req, res) => {
    const result = await replicateDependencies(req.body, req.user);
    res.status(201).json(result);
  })
);

router.put(
  "/dependencies/:id",
  validateParams(idParam),
  requireJson,
  validateBody(dependencyUpdate),
  asyncHandler(async (req, res) => {
    const item = await updateDependency(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.delete(
  "/dependencies/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteDependency(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/dependencies/:id/permanent",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteDependencyPermanent(req.params.id, req.user);
    res.json(item);
  })
);

router.get(
  "/dependencies/:id/permanent/summary",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getDependencyForceDeleteSummary(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/dependencies/:id/permanent/force",
  validateParams(idParam),
  requireJson,
  validateBody(forceDeleteBody),
  asyncHandler(async (req, res) => {
    const item = await deleteDependencyPermanentForce(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.put(
  "/dependencies/:id/reactivate",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await reactivateDependency(req.params.id, req.user);
    res.json(item);
  })
);

// Catalog Items
router.get(
  "/catalog-items",
  validateQuery(catalogItemsQuery),
  asyncHandler(async (req, res) => {
    const result = await listCatalogItems(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/catalog-items/official-key-availability",
  validateQuery(officialKeyAvailabilityQuery),
  asyncHandler(async (req, res) => {
    const result = await checkOfficialKeyAvailability(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/catalog-items/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getCatalogItem(req.params.id, req.user);
    res.json(item);
  })
);

router.post(
  "/catalog-items",
  requireJson,
  validateBody(catalogItemCreate),
  asyncHandler(async (req, res) => {
    const item = await createCatalogItem(req.body, req.user);
    res.status(201).json(item);
  })
);

router.post(
  "/catalog-items/bulk",
  requireJson,
  validateBody(catalogItemBulkCreate),
  asyncHandler(async (req, res) => {
    const result = await createCatalogItemsBulk(req.body, req.user);
    res.status(201).json(result);
  })
);

router.get(
  "/catalog-items/import/template/excel",
  asyncHandler(async (req, res) => {
    const workbook = await buildCatalogItemsImportTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=catalog_items_template.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  })
);

router.post(
  "/catalog-items/import/excel",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) {
      return sendError(res, {
        status: 400,
        error: "Archivo Excel requerido",
        code: "CATALOG_IMPORT_FILE_REQUIRED",
        requestId: req.id,
      });
    }
    const result = await importCatalogItemsFromExcel(
      req.file.buffer,
      req.user,
      req.file.originalname
    );
    res.status(201).json(result);
  })
);

router.put(
  "/catalog-items/:id",
  validateParams(idParam),
  requireJson,
  validateBody(catalogItemUpdate),
  asyncHandler(async (req, res) => {
    const item = await updateCatalogItem(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.delete(
  "/catalog-items/purge/reset",
  asyncHandler(async (req, res) => {
    const result = await purgeCatalogAndResetSequence(req.user);
    res.json(result);
  })
);

router.delete(
  "/catalog-items/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deleteCatalogItem(req.params.id, req.user);
    res.json(item);
  })
);

router.get(
  "/catalog-items/:id/permanent/summary",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getCatalogItemForceDeleteSummary(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/catalog-items/:id/permanent/force",
  validateParams(idParam),
  requireJson,
  validateBody(forceDeleteBody),
  asyncHandler(async (req, res) => {
    const item = await deleteCatalogItemPermanentForce(req.params.id, req.body, req.user);
    res.json(item);
  })
);

// Users
router.get(
  "/users",
  validateQuery(usersQuery),
  asyncHandler(async (req, res) => {
    const result = await listUsers(req.query, req.user);
    res.json(result);
  })
);

router.post(
  "/users",
  requireJson,
  validateBody(userCreate),
  asyncHandler(async (req, res) => {
    const item = await createUser(req.body, req.user);
    res.status(201).json(item);
  })
);

router.put(
  "/users/:id",
  validateParams(idParam),
  requireJson,
  validateBody(userUpdate),
  asyncHandler(async (req, res) => {
    const item = await updateUser(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.post(
  "/users/:id/reset-password",
  validateParams(idParam),
  requireJson,
  validateBody(userResetPasswordBody),
  asyncHandler(async (req, res) => {
    const item = await resetUserPassword(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.delete(
  "/users/:id",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await deactivateUser(req.params.id, req.user);
    res.json(item);
  })
);

router.put(
  "/users/:id/reactivate",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await reactivateUser(req.params.id, req.user);
    res.json(item);
  })
);

router.get(
  "/users/:id/permanent/summary",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await getUserForceDeleteSummary(req.params.id, req.user);
    res.json(item);
  })
);

router.delete(
  "/users/:id/permanent/force",
  validateParams(idParam),
  requireJson,
  validateBody(forceDeleteBody),
  asyncHandler(async (req, res) => {
    const item = await deleteUserPermanentForce(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.put(
  "/users/:id/photo",
  validateParams(idParam),
  uploadUserPhoto.single("file"),
  asyncHandler(async (req, res) => {
    const item = await setUserPhoto(Number(req.params.id), req.file, req.user);
    res.json(item);
  })
);

router.delete(
  "/users/:id/photo",
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const item = await clearUserPhoto(Number(req.params.id), req.user);
    res.json(item);
  })
);

// Assistant + support requests (ADMIN_CENTRAL)
router.post(
  "/assistant/ask",
  requireJson,
  validateBody(supportAskBody),
  asyncHandler(async (req, res) => {
    const result = await askAssistant(req.body, req.user);
    res.json(result);
  })
);

router.get(
  "/support-requests",
  validateQuery(supportRequestQuery),
  asyncHandler(async (req, res) => {
    const result = await listSupportRequests(req.query, req.user);
    res.json(result);
  })
);

router.post(
  "/support-requests",
  requireJson,
  validateBody(supportRequestCreate),
  asyncHandler(async (req, res) => {
    const item = await createSupportRequest(req.body, req.user);
    res.status(201).json(item);
  })
);

router.put(
  "/support-requests/:id/status",
  validateParams(idParam),
  requireJson,
  validateBody(supportRequestStatusUpdate),
  asyncHandler(async (req, res) => {
    const item = await updateSupportRequestStatus(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.post(
  "/support-requests/:id/comments",
  validateParams(idParam),
  requireJson,
  validateBody(supportRequestCommentCreate),
  asyncHandler(async (req, res) => {
    const item = await addSupportRequestComment(req.params.id, req.body, req.user);
    res.json(item);
  })
);

router.post(
  "/support-requests/test-email",
  requireJson,
  validateBody(supportEmailTestBody),
  asyncHandler(async (req, res) => {
    const item = await testSupportSmtp(req.body, req.user);
    res.json(item);
  })
);

// Admin audit
router.get(
  "/audit",
  validateQuery(adminAuditQuery),
  asyncHandler(async (req, res) => {
    const result = await listAdminAudits(req.query, req.user);
    res.json(result);
  })
);

router.post(
  "/audit/cleanup",
  requireJson,
  validateBody(auditCleanupBody),
  asyncHandler(async (req, res) => {
    const result = await cleanupAudits(req.body, req.user);
    res.json(result);
  })
);

router.get(
  "/login-audit",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const result = await listLoginAudits(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/login-audit/export/excel",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const workbook = await exportLoginAuditToExcel(req.query, req.user);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_audit_${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/login-audit/export/pdf",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const doc = await exportLoginAuditToPdf(req.query, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_audit_${Date.now()}.pdf`
    );
    doc.pipe(res);
    doc.end();
  })
);

router.get(
  "/login-audit/export/csv",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const { items } = await listLoginAudits(
      { ...req.query, take: 10000, skip: 0 },
      req.user
    );

    const lines = [
      "createdAt,email,userName,userId,ip,success,reason",
      ...items.map((a) =>
        [
          a.createdAt.toISOString(),
          a.email,
          a.user?.name || "",
          a.userId || "",
          a.ip,
          a.success ? "YES" : "NO",
          a.reason || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_audit_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/login-audit/metrics",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetrics(req.query, req.user);
    res.json({ items });
  })
);

router.get(
  "/login-audit/metrics/hourly",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetricsHourly(req.query, req.user);
    res.json({ items });
  })
);

router.get(
  "/login-audit/metrics/ip",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetricsByIp(req.query, req.user);
    res.json({ items });
  })
);

router.get(
  "/login-audit/metrics/user",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetricsByUser(req.query, req.user);
    res.json({ items });
  })
);

router.get(
  "/login-audit/metrics/hourly/export/csv",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetricsHourly(req.query, req.user);
    const lines = [
      "hour,success,failed",
      ...items.map((m) =>
        [m.hour, m.success, m.failed]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_hourly_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/login-audit/metrics/ip/export/csv",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetricsByIp(req.query, req.user);
    const lines = [
      "ip,success,failed",
      ...items.map((m) =>
        [m.ip, m.success, m.failed]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_ip_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/login-audit/metrics/user/export/csv",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetricsByUser(req.query, req.user);
    const lines = [
      "userId,userName,userEmail,success,failed",
      ...items.map((m) =>
        [
          m.userId || "",
          m.user?.name || "",
          m.user?.email || "",
          m.success,
          m.failed,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_user_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/login-audit/metrics/hourly/export/pdf",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const doc = await exportLoginMetricsHourlyPdf(req.query, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_hourly_${Date.now()}.pdf`
    );
    doc.pipe(res);
    doc.end();
  })
);

router.get(
  "/login-audit/metrics/ip/export/pdf",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const doc = await exportLoginMetricsIpPdf(req.query, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_ip_${Date.now()}.pdf`
    );
    doc.pipe(res);
    doc.end();
  })
);

router.get(
  "/login-audit/metrics/user/export/pdf",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const doc = await exportLoginMetricsUserPdf(req.query, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_user_${Date.now()}.pdf`
    );
    doc.pipe(res);
    doc.end();
  })
);

router.get(
  "/login-audit/metrics/export/csv",
  validateQuery(loginAuditQuery),
  asyncHandler(async (req, res) => {
    const items = await getLoginAuditMetrics(req.query, req.user);
    const lines = [
      "day,success,failed",
      ...items.map((m) =>
        [m.day, m.success, m.failed]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=login_metrics_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/audit/export/excel",
  validateQuery(adminAuditQuery),
  asyncHandler(async (req, res) => {
    const workbook = await exportAdminAuditToExcel(req.query, req.user);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=admin_audit_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/audit/export/pdf",
  validateQuery(adminAuditQuery),
  asyncHandler(async (req, res) => {
    const doc = await exportAdminAuditToPdf(req.query, req.user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=admin_audit_${Date.now()}.pdf`
    );

    doc.pipe(res);
    doc.end();
  })
);

router.get(
  "/audit/export/csv",
  validateQuery(adminAuditQuery),
  asyncHandler(async (req, res) => {
    const { items } = await listAdminAudits(
      { ...req.query, take: 10000, skip: 0 },
      req.user
    );
    const lines = [
      "createdAt,entityType,action,entityId,userName,userEmail",
      ...items.map((a) =>
        [
          a.createdAt.toISOString(),
          a.entityType,
          a.action,
          a.entityId,
          a.user?.name || "",
          a.user?.email || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=admin_audit_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/institutions/export/excel",
  asyncHandler(async (req, res) => {
    const workbook = await exportInstitutions(req.user);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=institutions_${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/institutions/export/csv",
  asyncHandler(async (req, res) => {
    const { items } = await listInstitutions({ take: 10000, skip: 0 }, req.user);
    const lines = [
      "id,name,createdAt",
      ...items.map((i) =>
        [i.id, i.name, i.createdAt.toISOString()]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=institutions_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/establishments/export/excel",
  asyncHandler(async (req, res) => {
    const workbook = await exportEstablishments(req.user);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=establishments_${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/establishments/export/csv",
  asyncHandler(async (req, res) => {
    const { items } = await listEstablishments({ take: 10000, skip: 0 }, req.user);
    const lines = [
      "id,name,type,rbd,commune,institutionId,createdAt",
      ...items.map((e) =>
        [e.id, e.name, e.type, e.rbd || "", e.commune || "", e.institutionId, e.createdAt.toISOString()]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=establishments_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

router.get(
  "/dependencies/export/excel",
  asyncHandler(async (req, res) => {
    const workbook = await exportDependencies(req.user);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=dependencies_${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/dependencies/export/csv",
  asyncHandler(async (req, res) => {
    const { items } = await listDependencies({ take: 10000, skip: 0 }, req.user);
    const lines = [
      "id,name,establishmentId,createdAt",
      ...items.map((d) =>
        [d.id, d.name, d.establishmentId, d.createdAt.toISOString()]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=dependencies_${Date.now()}.csv`
    );
    res.send(lines.join("\n"));
  })
);

module.exports = { adminCrudRouter: router };

