function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const CHILE_USEFUL_LIFE_RULES = [
  { years: 6, keywords: ["notebook", "laptop", "computador", "pc", "impresora", "scanner"] },
  { years: 5, keywords: ["tablet", "telefono", "celular", "radio", "switch", "router"] },
  { years: 7, keywords: ["vehiculo", "camioneta", "automovil", "furgon", "bus"] },
  { years: 10, keywords: ["mueble", "escritorio", "silla", "estante", "gabinete", "mesa"] },
  { years: 10, keywords: ["equipo", "maquina", "herramienta", "motor", "compresor"] },
  { years: 20, keywords: ["edificio", "construccion", "infraestructura"] },
];

const ACCOUNTING_ACCOUNT_RULES = [
  { years: 6, matchers: ["acc-imp", "informat", "comput", "tecnolog", "ti"] },
  { years: 5, matchers: ["telefono", "telecom", "comunic"] },
  { years: 10, matchers: ["mueble", "mobiliario"] },
  { years: 7, matchers: ["vehiculo", "transporte"] },
  { years: 20, matchers: ["edificio", "infraestructura"] },
];

const CATEGORY_RULES = [
  { years: 6, categoryMatchers: ["inventario_avanzado"], subcategoryMatchers: ["ti"] },
  { years: 6, categoryMatchers: ["tecnolog", "informat"] },
  { years: 10, categoryMatchers: ["mueble", "mobiliario"] },
  { years: 7, categoryMatchers: ["vehiculo", "transporte"] },
];

function includesAny(source, terms) {
  return terms.some((term) => source.includes(normalizeText(term)));
}

function startOfDay(date) {
  const d = new Date(date || Date.now());
  d.setHours(0, 0, 0, 0);
  return d;
}

function resolveUsefulLifeYearsFromPolicies(policyRows, context = {}) {
  if (!Array.isArray(policyRows) || !policyRows.length) return null;
  const account = normalizeText(context.accountingAccount);
  const category = normalizeText(context.category);
  const subcategory = normalizeText(context.subcategory);
  const asOfDate = startOfDay(context.acquisitionDate || new Date());

  const candidates = policyRows
    .filter((row) => String(row?.status || "").toUpperCase() === "VIGENTE")
    .filter((row) => {
      const appliesFrom = startOfDay(row.appliesFrom || new Date(0));
      return appliesFrom.getTime() <= asOfDate.getTime();
    })
    .map((row) => {
      const rowAccount = normalizeText(row.accountingAccount);
      const rowCategory = normalizeText(row.category);
      const rowSubcategory = normalizeText(row.subcategory);
      let score = 0;
      if (rowAccount && account && rowAccount === account) score += 100;
      if (rowCategory && category && rowCategory === category) score += 20;
      if (rowSubcategory && subcategory && rowSubcategory === subcategory) score += 10;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.row.appliesFrom).getTime() - new Date(a.row.appliesFrom).getTime();
    });

  if (!candidates.length) return null;
  const years = Number(candidates[0].row.usefulLifeYears);
  return Number.isInteger(years) && years > 0 ? years : null;
}

function estimateUsefulLifeYearsChile({
  name,
  accountingAccount,
  assetTypeName,
  category,
  subcategory,
}) {
  const source = [name, accountingAccount, assetTypeName, category, subcategory]
    .map(normalizeText)
    .join(" ");
  if (!source) return null;

  const accountNorm = normalizeText(accountingAccount);
  if (accountNorm) {
    const accountRule = ACCOUNTING_ACCOUNT_RULES.find((rule) =>
      includesAny(accountNorm, rule.matchers)
    );
    if (accountRule) return accountRule.years;
  }

  const categoryNorm = normalizeText(category);
  const subcategoryNorm = normalizeText(subcategory);
  if (categoryNorm || subcategoryNorm) {
    const categoryRule = CATEGORY_RULES.find((rule) => {
      const categoryMatch = rule.categoryMatchers
        ? includesAny(categoryNorm, rule.categoryMatchers)
        : true;
      const subcategoryMatch = rule.subcategoryMatchers
        ? includesAny(subcategoryNorm, rule.subcategoryMatchers)
        : true;
      return categoryMatch && subcategoryMatch;
    });
    if (categoryRule) return categoryRule.years;
  }

  const matchedByName = CHILE_USEFUL_LIFE_RULES.find((rule) =>
    rule.keywords.some((keyword) => source.includes(keyword))
  );
  if (matchedByName) return matchedByName.years;

  const type = normalizeText(assetTypeName);
  if (type.includes("control")) return 5;
  if (type.includes("fixed") || type.includes("fijo")) return 10;
  return null;
}

module.exports = {
  CHILE_USEFUL_LIFE_RULES,
  ACCOUNTING_ACCOUNT_RULES,
  CATEGORY_RULES,
  resolveUsefulLifeYearsFromPolicies,
  estimateUsefulLifeYearsChile,
};
