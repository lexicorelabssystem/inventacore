function toDateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? new Date(`${normalized}T00:00:00.000Z`)
      : new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toUtcDayStart(dateLike) {
  const parsed = toDateOrNull(dateLike);
  if (!parsed) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function toUtcDayEnd(dateLike) {
  const parsed = toDateOrNull(dateLike);
  if (!parsed) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function buildAcquisitionDateWhere({ fromDate, toDate } = {}) {
  const from = toUtcDayStart(fromDate);
  const to = toUtcDayEnd(toDate);
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

function buildScopedAssetWhere({
  establishmentId,
  dependencyId,
  fromDate,
  toDate,
  isDeleted,
} = {}) {
  const where = {
    ...(Number.isFinite(Number(establishmentId))
      ? { establishmentId: Number(establishmentId) }
      : {}),
    ...(Number.isFinite(Number(dependencyId))
      ? { dependencyId: Number(dependencyId) }
      : {}),
  };

  if (typeof isDeleted === "boolean") {
    where.isDeleted = isDeleted;
  }

  const acquisitionDate = buildAcquisitionDateWhere({ fromDate, toDate });
  if (acquisitionDate) {
    where.acquisitionDate = acquisitionDate;
  }

  return where;
}

module.exports = {
  toDateOrNull,
  toUtcDayStart,
  toUtcDayEnd,
  buildAcquisitionDateWhere,
  buildScopedAssetWhere,
};
