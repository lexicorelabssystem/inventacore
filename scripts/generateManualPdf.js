const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const srcPath = path.join(__dirname, "..", "docs", "manual-operativo-tecnico.md");
const outDir = path.join(__dirname, "..", "frontend", "public", "manual");
const outPath = path.join(outDir, "manual-operativo-tecnico.pdf");

function normalizeLine(line) {
  let text = String(line || "");
  text = text.replace(/^#{1,6}\s*/, "");
  text = text.replace(/^\-\s+/, "• ");
  text = text.replace(/^\d+\.\s+/, (m) => m);
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  return text.trimEnd();
}

function lineStyle(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { size: 10, gap: 4 };
  if (trimmed.startsWith("## ")) return { size: 14, gap: 8 };
  if (trimmed.startsWith("# ")) return { size: 18, gap: 10 };
  if (/^\d+\.\s+/.test(trimmed)) return { size: 11, gap: 4 };
  if (trimmed.startsWith("- ")) return { size: 11, gap: 3 };
  return { size: 11, gap: 4 };
}

function generate() {
  if (!fs.existsSync(srcPath)) {
    throw new Error(`No existe archivo fuente: ${srcPath}`);
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const markdown = fs.readFileSync(srcPath, "utf8");
  const lines = markdown.split(/\r?\n/);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 48, left: 52, right: 52 },
    info: {
      Title: "Manual Operativo y Tecnico del Sistema de Inventario",
      Author: "Sistema Inventario",
    },
  });

  doc.pipe(fs.createWriteStream(outPath));

  for (const raw of lines) {
    const style = lineStyle(raw);
    const text = normalizeLine(raw);
    doc.font("Helvetica").fontSize(style.size).fillColor("#111827");
    if (!text) {
      doc.moveDown(0.35);
      continue;
    }
    doc.text(text, { align: "left", lineGap: 1 });
    doc.moveDown(style.gap / 10);
  }

  doc.end();
  console.log(`PDF generado: ${outPath}`);
}

generate();

