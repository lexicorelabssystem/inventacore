const { z } = require("zod");
const { booleanLike } = require("./boolean");

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

const evidenceIdParam = z.object({
  id: z.coerce.number().int().positive(),
  evidenceId: z.coerce.number().int().positive(),
});

const movementActaParams = z.object({
  id: z.coerce.number().int().positive(),
  movementId: z.coerce.number().int().positive(),
});

const relocateBody = z.object({
  toDependencyId: z.coerce.number().int().positive(),
});

const transferBody = z.object({
  toEstablishmentId: z.coerce.number().int().positive(),
  toDependencyId: z.coerce.number().int().positive(),
  reasonCode: z.string().trim().max(64).optional(),
  docType: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000).optional(),
});

const statusChangeBody = z.object({
  assetStateId: z.coerce.number().int().positive(),
  reasonCode: z.string().trim().max(64).optional(),
  docType: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000).optional(),
});

const restoreBody = z.object({
  assetStateId: z.coerce.number().int().positive().optional(),
  reasonCode: z.string().trim().max(64).optional(),
  docType: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000).optional(),
});

const forceDeleteBody = z.object({
  confirmationText: z.string().trim().min(1).max(120),
});

const createAssetBody = z.object({
  institutionId: z.coerce.number().int().positive().optional(),
  establishmentId: z.coerce.number().int().positive(),
  dependencyId: z.coerce.number().int().positive(),
  assetStateId: z.coerce.number().int().positive(),
  assetTypeId: z.coerce.number().int().positive(),
  catalogItemId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  brand: z.string().trim().min(1).max(100).optional(),
  modelName: z.string().trim().min(1).max(100).optional(),
  serialNumber: z.string().trim().min(1).max(100).optional(),
  quantity: z.coerce.number().int().positive().max(100000).optional(),
  accountingAccount: z.string().trim().min(1).max(100),
  analyticCode: z.string().trim().min(1).max(100).optional(),
  responsibleName: z.string().trim().min(1).max(120).optional(),
  responsibleRut: z.string().trim().min(3).max(20).optional(),
  responsibleRole: z.string().trim().min(1).max(120).optional(),
  costCenter: z.string().trim().min(1).max(120).optional(),
  acquisitionValue: z.coerce.number().positive().max(1_000_000_000),
  depreciationStartDate: z.coerce.date().optional(),
  usefulLifeYears: z.coerce.number().int().positive().max(120).optional(),
  depreciationAnnualValue: z.coerce.number().positive().max(1_000_000_000).optional(),
  depreciationAnnualRate: z.coerce.number().positive().max(100).optional(),
  acquisitionDate: z.coerce.date().refine((d) => d.getTime() <= Date.now(), {
    message: "acquisitionDate no puede ser futura",
  }),
}).superRefine((val, ctx) => {
  if (val.institutionId !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["institutionId"],
      message: "institutionId no permitido en este endpoint",
    });
  }
  if (!val.name && !val.catalogItemId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "name es requerido si no se entrega catalogItemId",
    });
  }
});

const updateAssetBody = z
  .object({
    catalogItemId: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    brand: z.string().trim().min(1).max(100).optional(),
    modelName: z.string().trim().min(1).max(100).optional(),
    serialNumber: z.string().trim().min(1).max(100).optional(),
    quantity: z.coerce.number().int().positive().max(100000).optional(),
    accountingAccount: z.string().trim().min(1).max(100).optional(),
    analyticCode: z.string().trim().min(1).max(100).optional(),
    responsibleName: z.union([z.string().trim().min(1).max(120), z.literal("")]).optional(),
    responsibleRut: z.union([z.string().trim().min(3).max(20), z.literal("")]).optional(),
    responsibleRole: z.union([z.string().trim().min(1).max(120), z.literal("")]).optional(),
    costCenter: z.union([z.string().trim().min(1).max(120), z.literal("")]).optional(),
    acquisitionValue: z.coerce.number().positive().max(1_000_000_000).optional(),
    depreciationStartDate: z.coerce.date().optional(),
    usefulLifeYears: z.coerce.number().int().positive().max(120).optional(),
    depreciationAnnualValue: z.coerce.number().positive().max(1_000_000_000).optional(),
    depreciationAnnualRate: z.coerce.number().positive().max(100).optional(),
    acquisitionDate: z.coerce.date().refine((d) => d.getTime() <= Date.now(), {
      message: "acquisitionDate no puede ser futura",
    }).optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: "Se requiere al menos un campo",
  });

const depreciationSuggestionBody = z.object({
  catalogItemId: z.coerce.number().int().positive().optional(),
  assetTypeId: z.coerce.number().int().positive().optional(),
  accountingAccount: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  acquisitionValue: z.coerce.number().positive().max(1_000_000_000).optional(),
  acquisitionDate: z.coerce.date().optional(),
  depreciationStartDate: z.coerce.date().optional(),
  usefulLifeYears: z.coerce.number().int().positive().max(120).optional(),
  depreciationAnnualValue: z.coerce.number().positive().max(1_000_000_000).optional(),
  depreciationAnnualRate: z.coerce.number().positive().max(100).optional(),
});

const listAssetsQuery = z.object({
  id: z.coerce.number().int().positive().optional(),
  q: z.string().optional(),
  institutionId: z.coerce.number().int().positive().optional(),
  establishmentId: z.coerce.number().int().positive().optional(),
  dependencyId: z.coerce.number().int().positive().optional(),
  assetStateId: z.coerce.number().int().positive().optional(),
  includeDeleted: booleanLike,
  onlyDeleted: booleanLike,
  deletedFrom: z.coerce.date().optional(),
  deletedTo: z.coerce.date().optional(),
  assetType: z.enum(["FIXED", "CONTROL"]).optional(),
  brand: z.string().optional(),
  modelName: z.string().optional(),
  serialNumber: z.string().optional(),
  responsibleName: z.string().optional(),
  costCenter: z.string().optional(),
  internalCode: z.coerce.number().int().positive().optional(),
  minValue: z.coerce.number().nonnegative().optional(),
  maxValue: z.coerce.number().nonnegative().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z
    .enum(["id", "internalCode", "name", "acquisitionDate", "acquisitionValue"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  withCount: booleanLike,
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const importHistoryQuery = z.object({
  userId: z.coerce.number().int().positive().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const evidenceListQuery = z.object({
  movementId: z.coerce.number().int().positive().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const depreciationPoliciesQuery = z.object({
  q: z.string().optional(),
  includeInactive: booleanLike,
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const purgeAssetsQuery = z.object({
  purgeDependencies: booleanLike,
  purgeEstablishments: booleanLike,
  forceDeleteStructure: booleanLike,
});

module.exports = {
  idParam,
  evidenceIdParam,
  movementActaParams,
  relocateBody,
  transferBody,
  statusChangeBody,
  restoreBody,
  forceDeleteBody,
  createAssetBody,
  updateAssetBody,
  listAssetsQuery,
  importHistoryQuery,
  evidenceListQuery,
  depreciationPoliciesQuery,
  depreciationSuggestionBody,
  purgeAssetsQuery,
};

