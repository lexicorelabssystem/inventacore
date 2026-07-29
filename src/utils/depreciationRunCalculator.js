const { badRequest } = require("./httpError");
const {
  resolveDepreciationValues,
  validateDepreciationAnnualValue,
  validateUsefulLifeYears,
} = require("./assetRules");
const {
  resolveUsefulLifeYearsFromPolicies,
  estimateUsefulLifeYearsChile,
} = require("./chileDepreciationTable");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDayStart(dateValue) {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getYearBoundsUtc(year) {
  return {
    startMs: Date.UTC(year, 0, 1),
    endMs: Date.UTC(year + 1, 0, 1),
  };
}

function addYearsUtc(date, years) {
  const base = toUtcDayStart(date);
  if (!base || !Number.isInteger(years) || years <= 0) return null;
  return new Date(
    Date.UTC(base.getUTCFullYear() + years, base.getUTCMonth(), base.getUTCDate())
  );
}

function clampCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function buildAssetDepreciationSetup(asset, activePolicies = []) {
  const acquisitionValue = Number(asset?.acquisitionValue);
  if (!(Number.isFinite(acquisitionValue) && acquisitionValue > 0)) {
    throw badRequest("Asset sin acquisitionValue valido");
  }

  const acquisitionDate = toUtcDayStart(asset?.acquisitionDate);
  if (!acquisitionDate) {
    throw badRequest("Asset sin acquisitionDate valida");
  }

  const rawStartDate = toUtcDayStart(asset?.depreciationStartDate) || acquisitionDate;
  const effectiveStartDate =
    rawStartDate.getTime() < acquisitionDate.getTime() ? acquisitionDate : rawStartDate;

  const policyUsefulLife =
    Number.isInteger(Number(asset?.usefulLifeYears)) && Number(asset.usefulLifeYears) > 0
      ? Number(asset.usefulLifeYears)
      : resolveUsefulLifeYearsFromPolicies(activePolicies, {
          accountingAccount: asset?.accountingAccount,
          category: asset?.catalogItem?.category,
          subcategory: asset?.catalogItem?.subcategory,
          acquisitionDate,
        }) ||
        estimateUsefulLifeYearsChile({
          name: asset?.name,
          accountingAccount: asset?.accountingAccount,
          assetTypeName: asset?.assetType?.name,
          category: asset?.catalogItem?.category,
          subcategory: asset?.catalogItem?.subcategory,
        });

  const depreciationResolution = resolveDepreciationValues({
    acquisitionValue,
    usefulLifeYears: policyUsefulLife,
    depreciationAnnualValue:
      asset?.depreciationAnnualValue === undefined || asset?.depreciationAnnualValue === null
        ? null
        : Number(asset.depreciationAnnualValue),
    depreciationAnnualRate: null,
  });

  const usefulLifeYears = depreciationResolution.usefulLifeYears;
  const depreciationAnnualValue = depreciationResolution.depreciationAnnualValue;

  const usefulLifeError = validateUsefulLifeYears(usefulLifeYears);
  if (usefulLifeError) {
    throw badRequest(usefulLifeError);
  }

  const annualValueError = validateDepreciationAnnualValue(
    depreciationAnnualValue,
    acquisitionValue
  );
  if (annualValueError) {
    throw badRequest(annualValueError);
  }

  if (!usefulLifeYears || !depreciationAnnualValue) {
    throw badRequest("Asset sin configuracion de depreciacion completa");
  }

  const depreciableBase = clampCurrency(
    Math.min(acquisitionValue, depreciationAnnualValue * usefulLifeYears)
  );
  const residualAmount = clampCurrency(Math.max(0, acquisitionValue - depreciableBase));
  const lifeEndExclusive = addYearsUtc(effectiveStartDate, usefulLifeYears);

  if (!lifeEndExclusive) {
    throw badRequest("No se pudo calcular la vida util de depreciacion");
  }

  return {
    acquisitionValue: clampCurrency(acquisitionValue),
    acquisitionDate,
    depreciationStartDate: effectiveStartDate,
    usefulLifeYears,
    depreciationAnnualValue: clampCurrency(depreciationAnnualValue),
    depreciableBase,
    residualAmount,
    lifeEndExclusive,
  };
}

function calculateCumulativeDepreciationForYear({
  startDate,
  lifeEndExclusive,
  annualValue,
  fiscalYear,
}) {
  const startMs = startDate.getTime();
  const startYear = startDate.getUTCFullYear();
  if (fiscalYear < startYear) return 0;

  let total = 0;
  for (let year = startYear; year <= fiscalYear; year++) {
    const yearBounds = getYearBoundsUtc(year);
    const periodStartMs = Math.max(startMs, yearBounds.startMs);
    const periodEndMs = Math.min(lifeEndExclusive.getTime(), yearBounds.endMs);
    if (periodEndMs <= periodStartMs) continue;

    const daysCovered = (periodEndMs - periodStartMs) / MS_PER_DAY;
    const daysInYear = (yearBounds.endMs - yearBounds.startMs) / MS_PER_DAY;
    const yearDepreciation = clampCurrency(annualValue * (daysCovered / daysInYear));
    total = clampCurrency(total + yearDepreciation);
  }

  return total > 0 ? clampCurrency(total) : 0;
}

function calculateFiscalYearDepreciation(asset, activePolicies, fiscalYear) {
  const setup = buildAssetDepreciationSetup(asset, activePolicies);
  const year = Number(fiscalYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw badRequest("Año inválido");
  }

  const priorAccrued = calculateCumulativeDepreciationForYear({
    startDate: setup.depreciationStartDate,
    lifeEndExclusive: setup.lifeEndExclusive,
    annualValue: setup.depreciationAnnualValue,
    fiscalYear: year - 1,
  });
  const accruedThroughYear = calculateCumulativeDepreciationForYear({
    startDate: setup.depreciationStartDate,
    lifeEndExclusive: setup.lifeEndExclusive,
    annualValue: setup.depreciationAnnualValue,
    fiscalYear: year,
  });
  const priorAccruedCapped = Math.min(priorAccrued, setup.depreciableBase);
  const accruedThroughYearCapped = Math.min(accruedThroughYear, setup.depreciableBase);

  const openingBookValue = clampCurrency(setup.acquisitionValue - priorAccruedCapped);
  const closingBookValue = clampCurrency(setup.acquisitionValue - accruedThroughYearCapped);
  const annualDepreciation = clampCurrency(
    Math.max(0, accruedThroughYearCapped - priorAccruedCapped)
  );
  const accumulatedDepreciation = clampCurrency(accruedThroughYearCapped);
  const yearBounds = getYearBoundsUtc(year);
  const periodStartMs = Math.max(setup.depreciationStartDate.getTime(), yearBounds.startMs);
  const periodEndMs = Math.min(setup.lifeEndExclusive.getTime(), yearBounds.endMs);

  return {
    ...setup,
    fiscalYear: year,
    openingBookValue,
    annualDepreciation,
    closingBookValue,
    accumulatedDepreciation,
    periodStart: periodEndMs > periodStartMs ? new Date(periodStartMs) : null,
    periodEnd: periodEndMs > periodStartMs ? new Date(periodEndMs - 1) : null,
  };
}

module.exports = {
  MS_PER_DAY,
  toUtcDayStart,
  getYearBoundsUtc,
  addYearsUtc,
  clampCurrency,
  buildAssetDepreciationSetup,
  calculateCumulativeDepreciationForYear,
  calculateFiscalYearDepreciation,
};
