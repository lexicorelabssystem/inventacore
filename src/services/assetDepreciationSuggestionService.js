const { prisma } = require("../prisma");
const { badRequest, notFound } = require("../utils/httpError");
const {
  validateAcquisitionDate,
  validateAcquisitionValue,
  validateDateNotFuture,
  validateUsefulLifeYears,
  validateDepreciationAnnualValue,
  validateDepreciationAnnualRate,
  normalizeDepreciationRate,
  resolveDepreciationValues,
} = require("../utils/assetRules");
const {
  estimateUsefulLifeYearsChile,
  resolveUsefulLifeYearsFromPolicies,
} = require("../utils/chileDepreciationTable");

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function suggestAssetDepreciation(input = {}) {
  const acquisitionValue = toOptionalNumber(input.acquisitionValue);
  if (acquisitionValue !== null) {
    const error = validateAcquisitionValue(acquisitionValue);
    if (error) throw badRequest(error);
  }

  const acquisitionDate = toDateOrNull(input.acquisitionDate);
  if (acquisitionDate) {
    const error = validateAcquisitionDate(acquisitionDate);
    if (error) throw badRequest(error);
  }

  const depreciationStartDate = toDateOrNull(input.depreciationStartDate);
  if (depreciationStartDate) {
    const error = validateDateNotFuture("depreciationStartDate", depreciationStartDate);
    if (error) throw badRequest(error);
  }

  const usefulLifeYears = toOptionalNumber(input.usefulLifeYears);
  if (usefulLifeYears !== null) {
    const error = validateUsefulLifeYears(usefulLifeYears);
    if (error) throw badRequest(error);
  }

  const depreciationAnnualValue = toOptionalNumber(input.depreciationAnnualValue);
  if (depreciationAnnualValue !== null) {
    const error = validateDepreciationAnnualValue(
      depreciationAnnualValue,
      acquisitionValue === null ? undefined : acquisitionValue
    );
    if (error) throw badRequest(error);
  }

  const depreciationAnnualRate =
    input.depreciationAnnualRate === undefined || input.depreciationAnnualRate === null
      ? null
      : normalizeDepreciationRate(input.depreciationAnnualRate);
  if (depreciationAnnualRate !== null) {
    const error = validateDepreciationAnnualRate(depreciationAnnualRate);
    if (error) throw badRequest(error);
  }

  const [catalogItem, assetType, activeDepreciationPolicies] = await Promise.all([
    input.catalogItemId
      ? prisma.catalogItem.findUnique({
          where: { id: Number(input.catalogItemId) },
          select: { id: true, name: true, category: true, subcategory: true, brand: true, modelName: true },
        })
      : Promise.resolve(null),
    input.assetTypeId
      ? prisma.assetType.findUnique({
          where: { id: Number(input.assetTypeId) },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    prisma.depreciationPolicy.findMany({
      where: { status: "VIGENTE" },
      orderBy: [{ accountingAccount: "asc" }, { appliesFrom: "desc" }],
      select: {
        accountingAccount: true,
        category: true,
        subcategory: true,
        usefulLifeYears: true,
        appliesFrom: true,
        status: true,
      },
    }),
  ]);

  if (input.catalogItemId && !catalogItem) {
    throw notFound("CatalogItem no existe");
  }

  if (input.assetTypeId && !assetType) {
    throw notFound("AssetType no existe");
  }

  const policyReferenceDate = acquisitionDate || new Date();
  const estimatedUsefulLifeYears =
    usefulLifeYears ||
    resolveUsefulLifeYearsFromPolicies(activeDepreciationPolicies, {
      accountingAccount: input.accountingAccount,
      category: catalogItem?.category,
      subcategory: catalogItem?.subcategory,
      acquisitionDate: policyReferenceDate,
    }) ||
    estimateUsefulLifeYearsChile({
      name: input.name || catalogItem?.name,
      accountingAccount: input.accountingAccount,
      assetTypeName: assetType?.name,
      category: catalogItem?.category,
      subcategory: catalogItem?.subcategory,
    });

  const depreciationResolution = resolveDepreciationValues({
    acquisitionValue,
    usefulLifeYears: estimatedUsefulLifeYears,
    depreciationAnnualValue,
    depreciationAnnualRate,
  });

  return {
    catalogItem,
    assetType,
    depreciationStartDate: depreciationStartDate || acquisitionDate || null,
    usefulLifeYears: depreciationResolution.usefulLifeYears,
    depreciationAnnualValue: depreciationResolution.depreciationAnnualValue,
    depreciationAnnualRate: depreciationResolution.depreciationAnnualRate,
  };
}

module.exports = { suggestAssetDepreciation };
