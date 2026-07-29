const BASIC_CHARACTERISTICS_REMOVALS = [/GENERICO\s*-\s*CAMA 1 PLAZA/gi];

function sanitizeBasicCharacteristicsText(value) {
  let text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  BASIC_CHARACTERISTICS_REMOVALS.forEach((pattern) => {
    text = text.replace(pattern, " ");
  });

  return text
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/^\s*-\s*/g, "")
    .replace(/\s*-\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

module.exports = {
  sanitizeBasicCharacteristicsText,
};
