const MAX_ACQUISITION_VALUE = 1_000_000_000; // CLP 1B default ceiling
const MAX_NAME_LENGTH = 200;
const MAX_SHORT_TEXT = 100;
const MAX_USEFUL_LIFE_YEARS = 120;

function isFutureDate(d) {
  return d instanceof Date && d.getTime() > Date.now();
}

function validateAcquisitionDate(d) {
  return validateDateNotFuture("acquisitionDate", d);
}

function validateDateNotFuture(fieldName, d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return `${fieldName} invalida`;
  }
  if (isFutureDate(d)) {
    return `${fieldName} no puede ser futura`;
  }
  return null;
}

function validateAcquisitionValue(v) {
  if (!(Number.isFinite(v) && v > 0)) {
    return "acquisitionValue invalido";
  }
  if (v > MAX_ACQUISITION_VALUE) {
    return "acquisitionValue excede el maximo permitido";
  }
  return null;
}

function normalizeDepreciationRate(value) {
  if (value === undefined || value === null || value === "") return null;
  let rate = Number(value);
  if (!Number.isFinite(rate)) return Number.NaN;
  if (rate > 0 && rate <= 1) rate *= 100;
  return rate;
}

function resolveDepreciationValues({
  acquisitionValue,
  usefulLifeYears,
  depreciationAnnualValue,
  depreciationAnnualRate,
}) {
  const result = {
    usefulLifeYears: usefulLifeYears ?? null,
    depreciationAnnualValue: depreciationAnnualValue ?? null,
    depreciationAnnualRate: depreciationAnnualRate ?? null,
  };

  const safeAcquisition = Number(acquisitionValue);
  if (!Number.isFinite(safeAcquisition) || safeAcquisition <= 0) {
    return result;
  }

  if (!result.depreciationAnnualValue && result.depreciationAnnualRate) {
    result.depreciationAnnualValue =
      Number((safeAcquisition * (result.depreciationAnnualRate / 100)).toFixed(2)) || null;
  }
  if (!result.depreciationAnnualValue && result.usefulLifeYears) {
    result.depreciationAnnualValue = Number((safeAcquisition / result.usefulLifeYears).toFixed(2));
  }
  if (!result.usefulLifeYears && result.depreciationAnnualValue) {
    result.usefulLifeYears = Math.max(
      1,
      Math.round(safeAcquisition / Number(result.depreciationAnnualValue))
    );
  }
  if (!result.depreciationAnnualRate && result.depreciationAnnualValue) {
    result.depreciationAnnualRate = Number(
      ((Number(result.depreciationAnnualValue) / safeAcquisition) * 100).toFixed(6)
    );
  }

  return result;
}

function validateUsefulLifeYears(value) {
  if (value === undefined || value === null) return null;
  const years = Number(value);
  if (!Number.isInteger(years) || years <= 0) {
    return "usefulLifeYears invalido";
  }
  if (years > MAX_USEFUL_LIFE_YEARS) {
    return `usefulLifeYears excede el maximo de ${MAX_USEFUL_LIFE_YEARS}`;
  }
  return null;
}

function validateDepreciationAnnualValue(value, acquisitionValue) {
  if (value === undefined || value === null) return null;
  const annualValue = Number(value);
  if (!(Number.isFinite(annualValue) && annualValue > 0)) {
    return "depreciationAnnualValue invalido";
  }
  if (acquisitionValue !== undefined && acquisitionValue !== null) {
    const acquisition = Number(acquisitionValue);
    if (Number.isFinite(acquisition) && acquisition > 0 && annualValue > acquisition) {
      return "depreciationAnnualValue no puede superar acquisitionValue";
    }
  }
  return null;
}

function validateDepreciationAnnualRate(value) {
  if (value === undefined || value === null) return null;
  const rate = Number(value);
  if (!(Number.isFinite(rate) && rate > 0 && rate <= 100)) {
    return "depreciationAnnualRate invalido";
  }
  return null;
}

function validateStringMax(name, value, max) {
  if (value === undefined || value === null) return null;
  const s = String(value);
  if (s.length > max) {
    return `${name} excede el maximo de ${max}`;
  }
  return null;
}

function normalizeCostCenter(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.toUpperCase();
}

function normalizeRut(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;
  const compact = raw.replace(/\./g, "").replace(/\s+/g, "");
  const match = compact.match(/^(\d{7,8})-?([\dK])$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

function validateRutFormat(name, value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (!normalizeRut(value)) {
    return `${name} invalido. Usa formato 12345678-9`;
  }
  return null;
}

module.exports = {
  MAX_ACQUISITION_VALUE,
  MAX_NAME_LENGTH,
  MAX_SHORT_TEXT,
  MAX_USEFUL_LIFE_YEARS,
  validateAcquisitionDate,
  validateDateNotFuture,
  validateAcquisitionValue,
  normalizeDepreciationRate,
  resolveDepreciationValues,
  validateUsefulLifeYears,
  validateDepreciationAnnualValue,
  validateDepreciationAnnualRate,
  validateStringMax,
  normalizeCostCenter,
  normalizeRut,
  validateRutFormat,
};
