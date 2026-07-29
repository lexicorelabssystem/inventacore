function formatAssetCode(internalCode, options = {}) {
  const prefix = String(options.prefix || "MAU").trim().toUpperCase();
  const padLength = Number.isInteger(options.padLength) ? options.padLength : 7;
  const separator = options.separator === undefined ? "" : String(options.separator);
  const value = Number(internalCode);
  if (!Number.isInteger(value) || value <= 0) return "";
  return `${prefix}${separator}${String(value).padStart(Math.max(1, padLength), "0")}`;
}

function withSequentialVisibleCode(items, options = {}) {
  const startAt = Number.isInteger(options.startAt) && options.startAt > 0 ? options.startAt : 1;
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    visibleCode: startAt + index,
  }));
}

module.exports = {
  formatAssetCode,
  withSequentialVisibleCode,
};
