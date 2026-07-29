const path = require("node:path");
const ExcelJS = require("exceljs");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyCellValue(value) {
  if (value === null || value === undefined) return true;
  if (value instanceof Date) return false;
  const text = String(value).trim();
  return text === "";
}

function tokenize(value) {
  const text = normalizeText(value);
  if (!text) return [];
  return Array.from(new Set(text.split(" ").filter(Boolean)));
}

function jaccardScore(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function headerAliasToField(normalizedHeader) {
  const aliases = {
    serie: "serie",
    color: "color",
    medidas: "medidas",
    caracteristicas: "caracteristicas",
    proveedorrut: "proveedorRut",
    proveedornombre: "proveedorNombre",
    ordencompra: "ordenCompra",
    ocfecha: "ocFecha",
    factura: "factura",
    facturayoactoadministrativo: "factura",
    facturafecha: "facturaFecha",
    guia: "guia",
    guiafecha: "guiaFecha",
    foliodevengo: "folioDevengo",
    nombredelbien: "nombreBien",
    marca: "marca",
    modelo: "modelo",
    establecimientooficinarfetc: "establecimiento",
    ubicacionnombre: "ubicacion",
  };
  return aliases[normalizedHeader] || null;
}

function collectColumns(sheet) {
  const columns = {};
  const normalizedToColumn = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const normalized = normalizeText(cell.value).replace(/\s/g, "");
    if (!normalized) return;
    normalizedToColumn[normalized] = colNumber;
    const field = headerAliasToField(normalized);
    if (!field) return;
    if (!columns[field]) columns[field] = [];
    columns[field].push(colNumber);
  });
  return { columns, normalizedToColumn };
}

function getFieldValue(row, columns, field) {
  const colList = columns[field] || [];
  for (const col of colList) {
    const value = row.getCell(col).value;
    if (!isEmptyCellValue(value)) return value;
  }
  return "";
}

function setFieldValue(row, columns, field, value) {
  const colList = columns[field] || [];
  if (!colList.length) return false;
  let changed = false;
  for (const col of colList) {
    const current = row.getCell(col).value;
    if (isEmptyCellValue(current)) {
      row.getCell(col).value = value;
      changed = true;
    }
  }
  return changed;
}

function mergeKnownValues(base, incoming) {
  const out = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (!isEmptyCellValue(value)) out[key] = value;
  }
  return out;
}

function buildSignature(row, columns) {
  const nombre = getFieldValue(row, columns, "nombreBien");
  const marca = getFieldValue(row, columns, "marca");
  const modelo = getFieldValue(row, columns, "modelo");
  const ubicacion = getFieldValue(row, columns, "ubicacion");
  const establecimiento = getFieldValue(row, columns, "establecimiento");
  const caracteristicas = getFieldValue(row, columns, "caracteristicas");
  const medidas = getFieldValue(row, columns, "medidas");

  const strong = normalizeText([nombre, marca, modelo, ubicacion, establecimiento].join(" | "));
  const loose = normalizeText([nombre, marca, modelo].join(" | "));
  const doc = normalizeText(
    [
      getFieldValue(row, columns, "proveedorRut"),
      getFieldValue(row, columns, "proveedorNombre"),
      getFieldValue(row, columns, "ordenCompra"),
    ].join(" | ")
  );
  const tokens = tokenize([nombre, marca, modelo, caracteristicas, medidas].join(" "));
  return { strong, loose, doc, tokens };
}

function pickBestFuzzyRecord(records, targetTokens) {
  let best = null;
  let bestScore = 0;
  for (const record of records) {
    const score = jaccardScore(record.tokens, targetTokens);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }
  if (!best || bestScore < 0.6) return null;
  return best;
}

async function run() {
  const inputPathArg = process.argv[2];
  if (!inputPathArg) {
    throw new Error("Uso: node scripts/fillExcelSimilarity.js <archivo.xlsx> [salida.xlsx]");
  }
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  const outputPath =
    process.argv[3] && String(process.argv[3]).trim()
      ? path.resolve(process.cwd(), process.argv[3])
      : path.join(
          path.dirname(inputPath),
          `${path.basename(inputPath, path.extname(inputPath))}_rellenado_similitud.xlsx`
        );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  let totalChanges = 0;
  const perFieldChanges = {
    serie: 0,
    color: 0,
    medidas: 0,
    caracteristicas: 0,
    proveedorRut: 0,
    proveedorNombre: 0,
    ordenCompra: 0,
    ocFecha: 0,
    factura: 0,
    facturaFecha: 0,
    guia: 0,
    guiaFecha: 0,
    folioDevengo: 0,
  };

  const visualFields = ["serie", "color", "medidas", "caracteristicas"];
  const procurementFields = [
    "proveedorRut",
    "proveedorNombre",
    "ordenCompra",
    "ocFecha",
    "factura",
    "facturaFecha",
    "guia",
    "guiaFecha",
    "folioDevengo",
  ];
  const allTargetFields = [...visualFields, ...procurementFields];

  for (const sheet of workbook.worksheets) {
    const { columns } = collectColumns(sheet);
    const hasAnyTarget = allTargetFields.some((field) => (columns[field] || []).length);
    if (!hasAnyTarget) continue;

    const strongMemory = new Map();
    const looseMemory = new Map();
    const docMemory = new Map();
    const history = [];

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum += 1) {
      const row = sheet.getRow(rowNum);
      const signature = buildSignature(row, columns);

      const rowValues = {};
      for (const field of allTargetFields) {
        rowValues[field] = getFieldValue(row, columns, field);
      }

      if (isEmptyCellValue(rowValues.factura)) {
        const val = getFieldValue(row, columns, "factura");
        if (!isEmptyCellValue(val)) rowValues.factura = val;
      }

      const strongMatch = signature.strong ? strongMemory.get(signature.strong) : null;
      const looseMatch = signature.loose ? looseMemory.get(signature.loose) : null;
      const docMatch = signature.doc ? docMemory.get(signature.doc) : null;
      const fuzzyMatch = pickBestFuzzyRecord(history, signature.tokens);

      for (const field of allTargetFields) {
        if (!isEmptyCellValue(rowValues[field])) continue;

        let candidate = "";
        if (strongMatch && !isEmptyCellValue(strongMatch[field])) candidate = strongMatch[field];
        if (isEmptyCellValue(candidate) && looseMatch && !isEmptyCellValue(looseMatch[field])) {
          candidate = looseMatch[field];
        }
        if (
          isEmptyCellValue(candidate) &&
          procurementFields.includes(field) &&
          docMatch &&
          !isEmptyCellValue(docMatch[field])
        ) {
          candidate = docMatch[field];
        }
        if (isEmptyCellValue(candidate) && fuzzyMatch && !isEmptyCellValue(fuzzyMatch[field])) {
          candidate = fuzzyMatch[field];
        }

        if (!isEmptyCellValue(candidate) && setFieldValue(row, columns, field, candidate)) {
          rowValues[field] = candidate;
          totalChanges += 1;
          perFieldChanges[field] += 1;
        }
      }

      if (!isEmptyCellValue(rowValues.factura)) {
        setFieldValue(row, columns, "factura", rowValues.factura);
      }

      const knownValues = {};
      for (const field of allTargetFields) {
        if (!isEmptyCellValue(rowValues[field])) knownValues[field] = rowValues[field];
      }

      if (signature.strong) {
        strongMemory.set(
          signature.strong,
          mergeKnownValues(strongMemory.get(signature.strong) || {}, knownValues)
        );
      }
      if (signature.loose) {
        looseMemory.set(
          signature.loose,
          mergeKnownValues(looseMemory.get(signature.loose) || {}, knownValues)
        );
      }
      if (signature.doc) {
        docMemory.set(signature.doc, mergeKnownValues(docMemory.get(signature.doc) || {}, knownValues));
      }
      if (Object.keys(knownValues).length && signature.tokens.length) {
        history.push({ ...knownValues, tokens: signature.tokens });
      }
    }
  }

  await workbook.xlsx.writeFile(outputPath);

  console.log(`Archivo salida: ${outputPath}`);
  console.log(`Total celdas rellenadas: ${totalChanges}`);
  for (const [field, count] of Object.entries(perFieldChanges)) {
    console.log(`${field}: ${count}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
