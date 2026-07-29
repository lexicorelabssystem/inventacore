const ExcelJS = require("exceljs");
const { prisma } = require("../prisma");
const { forbidden, badRequest } = require("../utils/httpError");

function assertCentralAdmin(user) {
  if (user?.role?.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede gestionar politicas de depreciacion");
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseDateStrict(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
}

function parsePoliciesCsv(buffer) {
  const content = String(buffer || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = parts[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function buildPolicyKey({
  accountingAccount,
  category,
  subcategory,
  method,
  appliesFrom,
}) {
  const date = new Date(appliesFrom);
  const ymd = Number.isNaN(date.getTime()) ? "0000-00-00" : date.toISOString().slice(0, 10);
  return [
    normalizeText(accountingAccount).toUpperCase(),
    normalizeText(category).toUpperCase(),
    normalizeText(subcategory).toUpperCase(),
    normalizeText(method).toUpperCase(),
    ymd,
  ].join("|");
}

function normalizePolicyRow(raw, rowNumber) {
  const account = normalizeText(raw.cuenta_contable || raw.accounting_account);
  const accountName = normalizeText(raw.nombre_cuenta || raw.account_name);
  const category = normalizeText(raw.categoria_activo || raw.category);
  const subcategory = normalizeText(raw.subcategoria_activo || raw.subcategory);
  const usefulLifeYears = toNumber(raw.vida_util_anios || raw.useful_life_years);
  const annualRatePct = toNumber(
    raw.tasa_depreciacion_anual_pct || raw.annual_rate_pct || raw.tasa_depreciacion_pct
  );
  const method = normalizeText(raw.metodo_depreciacion || raw.method || "LINEAL").toUpperCase();
  const residualRatePct = toNumber(raw.valor_residual_pct || raw.residual_rate_pct || 0);
  const appliesFrom = parseDateStrict(raw.aplica_desde || raw.applies_from);
  const observations = normalizeText(raw.observaciones || raw.observations) || null;
  const status = normalizeText(raw.estado || raw.status || "VIGENTE").toUpperCase();

  const errors = [];
  if (!account) errors.push("cuenta_contable");
  if (!accountName) errors.push("nombre_cuenta");
  if (!(Number.isInteger(usefulLifeYears) && usefulLifeYears > 0)) errors.push("vida_util_anios");
  if (!(Number.isFinite(annualRatePct) && annualRatePct > 0)) errors.push("tasa_depreciacion_anual_pct");
  if (!["LINEAL"].includes(method)) errors.push("metodo_depreciacion");
  if (!(Number.isFinite(residualRatePct) && residualRatePct >= 0 && residualRatePct <= 100)) {
    errors.push("valor_residual_pct");
  }
  if (!appliesFrom) errors.push("aplica_desde");
  if (!["VIGENTE", "INACTIVA"].includes(status)) errors.push("estado");

  if (errors.length) {
    return { row: rowNumber, errors };
  }

  return {
    row: rowNumber,
    data: {
      policyKey: buildPolicyKey({
        accountingAccount: account,
        category,
        subcategory,
        method,
        appliesFrom,
      }),
      accountingAccount: account,
      accountName,
      category: category || null,
      subcategory: subcategory || null,
      usefulLifeYears: Number(usefulLifeYears),
      annualRatePct: Number(annualRatePct),
      method,
      residualRatePct: Number(residualRatePct),
      appliesFrom,
      observations,
      status,
    },
  };
}

async function parsePoliciesXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers = {};
  headerRow.eachCell((cell, col) => {
    headers[normalizeHeader(cell.value)] = col;
  });

  const getCell = (row, key) => {
    const col = headers[normalizeHeader(key)];
    return col ? row.getCell(col).value : undefined;
  };

  const rows = [];
  for (let i = 2; i <= sheet.lastRow.number; i += 1) {
    const row = sheet.getRow(i);
    const hasData = row.values.slice(1).some((val) => normalizeText(val) !== "");
    if (!hasData) continue;
    rows.push({
      cuenta_contable: getCell(row, "cuenta_contable"),
      nombre_cuenta: getCell(row, "nombre_cuenta"),
      categoria_activo: getCell(row, "categoria_activo"),
      subcategoria_activo: getCell(row, "subcategoria_activo"),
      vida_util_anios: getCell(row, "vida_util_anios"),
      tasa_depreciacion_anual_pct: getCell(row, "tasa_depreciacion_anual_pct"),
      metodo_depreciacion: getCell(row, "metodo_depreciacion"),
      valor_residual_pct: getCell(row, "valor_residual_pct"),
      aplica_desde: getCell(row, "aplica_desde"),
      observaciones: getCell(row, "observaciones"),
      estado: getCell(row, "estado"),
      __rowNumber: i,
    });
  }
  return rows;
}

async function listDepreciationPolicies(query, user) {
  assertCentralAdmin(user);
  const take = Math.min(Math.max(Number(query.take) || 50, 1), 200);
  const skip = Math.max(Number(query.skip) || 0, 0);
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";
  const q = normalizeText(query.q);

  const where = {
    ...(includeInactive ? {} : { status: "VIGENTE" }),
  };
  if (q) {
    where.OR = [
      { accountingAccount: { contains: q, mode: "insensitive" } },
      { accountName: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { subcategory: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.depreciationPolicy.findMany({
      where,
      orderBy: [{ accountingAccount: "asc" }, { appliesFrom: "desc" }],
      skip,
      take,
    }),
    prisma.depreciationPolicy.count({ where }),
  ]);

  return { items, total, take, skip };
}

async function importDepreciationPoliciesFromFile(buffer, filename, user) {
  assertCentralAdmin(user);
  if (!buffer) throw badRequest("Archivo requerido");
  const lowerName = String(filename || "").toLowerCase();

  let rawRows = [];
  if (lowerName.endsWith(".xlsx")) {
    rawRows = await parsePoliciesXlsx(buffer);
  } else if (lowerName.endsWith(".csv")) {
    rawRows = parsePoliciesCsv(buffer);
  } else {
    throw badRequest("Formato no soportado. Usa .xlsx o .csv");
  }

  if (!rawRows.length) throw badRequest("El archivo no tiene filas de datos");

  const errors = [];
  const normalizedRows = [];
  rawRows.forEach((raw, idx) => {
    const rowNumber = raw.__rowNumber || idx + 2;
    const normalized = normalizePolicyRow(raw, rowNumber);
    if (normalized.errors) {
      errors.push({
        row: rowNumber,
        fields: normalized.errors,
        error: "Fila invalida",
      });
      return;
    }
    normalizedRows.push(normalized.data);
  });

  let created = 0;
  let updated = 0;
  for (const row of normalizedRows) {
    const existing = await prisma.depreciationPolicy.findUnique({
      where: { policyKey: row.policyKey },
      select: { id: true },
    });
    if (existing) {
      await prisma.depreciationPolicy.update({
        where: { policyKey: row.policyKey },
        data: row,
      });
      updated += 1;
    } else {
      await prisma.depreciationPolicy.create({ data: row });
      created += 1;
    }
  }

  return {
    totalRows: rawRows.length,
    validRows: normalizedRows.length,
    created,
    updated,
    errorCount: errors.length,
    errors,
  };
}

async function buildDepreciationPolicyTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Politica_Depreciacion");
  sheet.addRow([
    "cuenta_contable",
    "nombre_cuenta",
    "categoria_activo",
    "subcategoria_activo",
    "vida_util_anios",
    "tasa_depreciacion_anual_pct",
    "metodo_depreciacion",
    "valor_residual_pct",
    "aplica_desde",
    "observaciones",
    "estado",
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    "ACC-IMP",
    "Equipos TI",
    "INVENTARIO_AVANZADO",
    "TI-002",
    6,
    16.6667,
    "LINEAL",
    0,
    "2026-01-01",
    "Regla referencial para equipos de computacion",
    "VIGENTE",
  ]);
  return workbook;
}

module.exports = {
  listDepreciationPolicies,
  importDepreciationPoliciesFromFile,
  buildDepreciationPolicyTemplateWorkbook,
};
