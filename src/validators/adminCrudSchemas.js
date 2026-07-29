const { z } = require("zod");
const { booleanLike } = require("./boolean");

const optionalPositiveInt = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  return Number(raw);
}, z.number().int().positive().optional());

const pagination = z.object({
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  includeInactive: booleanLike,
});

const establishmentsQuery = pagination.extend({
  institutionId: z.coerce.number().int().positive().optional(),
});

const dependenciesQuery = pagination.extend({
  establishmentId: z.coerce.number().int().positive().optional(),
});

const adminAuditQuery = z.object({
  entityType: z
    .enum(["INSTITUTION", "ESTABLISHMENT", "DEPENDENCY", "CATALOG_ITEM", "USER"])
    .optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE", "DEACTIVATE"]).optional(),
  userId: z.coerce.number().int().positive().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const loginAuditQuery = z.object({
  email: z.string().optional(),
  success: booleanLike,
  userId: z.coerce.number().int().positive().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  hourFrom: z.coerce.number().int().min(0).max(23).optional(),
  hourTo: z.coerce.number().int().min(0).max(23).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const auditCleanupBody = z
  .object({
    scope: z.enum(["ADMIN", "LOGIN", "ALL"]),
    mode: z.enum(["DELETE_ALL", "BEFORE_DATE", "KEEP_DAYS"]),
    beforeDate: z.string().trim().optional(),
    keepDays: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "BEFORE_DATE") {
      if (!value.beforeDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["beforeDate"],
          message: "beforeDate es requerido para mode=BEFORE_DATE",
        });
        return;
      }
      const d = new Date(value.beforeDate);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["beforeDate"],
          message: "beforeDate invalida. Usa formato YYYY-MM-DD",
        });
      }
    }
    if (value.mode === "KEEP_DAYS" && !value.keepDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["keepDays"],
        message: "keepDays es requerido para mode=KEEP_DAYS",
      });
    }
  });

const usersQuery = z.object({
  q: z.string().optional(),
  institutionId: z.coerce.number().int().positive().optional(),
  establishmentId: z.coerce.number().int().positive().optional(),
  roleType: z.enum(["ADMIN_CENTRAL", "ADMIN_ESTABLISHMENT", "VIEWER"]).optional(),
  includeInactive: booleanLike,
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

const forceDeleteBody = z.object({
  confirmationText: z.string().trim().min(1).max(120),
});

const institutionCreate = z.object({
  name: z.string().trim().min(1),
});

const institutionUpdate = z.object({
  name: z.string().trim().min(1).optional(),
});

const establishmentCreate = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  rbd: z.string().trim().min(1).optional(),
  commune: z.string().trim().min(1).optional(),
  institutionId: z.coerce.number().int().positive(),
});

const establishmentUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  rbd: z.string().trim().min(1).optional(),
  commune: z.string().trim().min(1).optional(),
  institutionId: z.coerce.number().int().positive().optional(),
});

const establishmentBulkCreate = z.object({
  items: z.array(establishmentCreate).min(1).max(500),
});

const dependencyCreate = z.object({
  name: z.string().trim().min(1),
  establishmentId: z.coerce.number().int().positive(),
});

const dependencyUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  establishmentId: z.coerce.number().int().positive().optional(),
});

const dependencyBulkCreate = z.object({
  items: z.array(dependencyCreate).min(1).max(500),
});

const dependencyReplicateBody = z.object({
  sourceEstablishmentId: z.coerce.number().int().positive(),
  targetEstablishmentId: z.coerce.number().int().positive(),
  includeInactive: booleanLike,
});

const catalogItemsQuery = pagination.extend({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  modelName: z.string().optional(),
});

const catalogItemCreate = z.object({
  officialKey: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().min(1).max(100).optional(),
  brand: z.string().trim().min(1).max(100).optional(),
  modelName: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
});

const catalogItemUpdate = z.object({
  officialKey: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  subcategory: z.string().trim().min(1).max(100).optional(),
  brand: z.string().trim().min(1).max(100).optional(),
  modelName: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
});

const catalogItemBulkCreate = z.object({
  items: z.array(catalogItemCreate).min(1).max(1000),
});

const officialKeyAvailabilityQuery = z.object({
  officialKey: z.string().trim().min(1).max(120),
  excludeId: z.coerce.number().int().positive().optional(),
});

const userCreate = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  roleType: z.enum(["ADMIN_CENTRAL", "ADMIN_ESTABLISHMENT", "VIEWER"]),
  institutionId: optionalPositiveInt,
  establishmentId: optionalPositiveInt,
});

const userUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roleType: z.enum(["ADMIN_CENTRAL", "ADMIN_ESTABLISHMENT", "VIEWER"]).optional(),
  institutionId: optionalPositiveInt,
  establishmentId: optionalPositiveInt,
});

const userResetPasswordBody = z.object({
  password: z.string().min(8).max(100),
});

const supportAskBody = z.object({
  question: z.string().trim().min(5).max(2000),
  institutionId: optionalPositiveInt,
  establishmentId: optionalPositiveInt,
  dependencyId: optionalPositiveInt,
});

const supportRequestCreate = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  question: z.string().trim().min(5).max(4000),
  responseDraft: z.string().trim().max(4000).optional(),
  contactEmail: z.string().trim().email().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueHours: z.coerce.number().int().min(1).max(720).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  institutionId: optionalPositiveInt,
  establishmentId: optionalPositiveInt,
  dependencyId: optionalPositiveInt,
});

const supportRequestQuery = z.object({
  q: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "OVERDUE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  institutionId: z.coerce.number().int().positive().optional(),
  establishmentId: z.coerce.number().int().positive().optional(),
  dependencyId: z.coerce.number().int().positive().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const supportRequestStatusUpdate = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "OVERDUE"]),
  assignedToId: optionalPositiveInt,
});

const supportRequestCommentCreate = z.object({
  message: z.string().trim().min(1).max(2000),
});

const supportEmailTestBody = z.object({
  email: z.string().trim().email().optional(),
});

module.exports = {
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
};

