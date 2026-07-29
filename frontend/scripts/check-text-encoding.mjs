import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const FILE_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const badMojibakePattern = /[ÃÂâ�]/;
const rawJsxUnicodeEscapePattern = />[^<{]*\\u[0-9a-fA-F]{4}[^<{]*</;

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    const ext = path.extname(entry.name);
    if (FILE_EXT.has(ext)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const issues = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (badMojibakePattern.test(line)) {
      issues.push({
        filePath,
        line: i + 1,
        reason: "Texto con posible codificacion corrupta (mojibake).",
      });
    }
    if (rawJsxUnicodeEscapePattern.test(line)) {
      issues.push({
        filePath,
        line: i + 1,
        reason:
          "Escape Unicode en texto JSX plano. Usa expresion JSX (por ejemplo {'A\\u00f1o'}) o caracter UTF-8.",
      });
    }
  }
}

if (!issues.length) {
  console.log("Encoding check OK: sin problemas detectados.");
  process.exit(0);
}

console.error("Encoding check FAILED:");
for (const issue of issues) {
  const relativePath = path.relative(process.cwd(), issue.filePath);
  console.error(`- ${relativePath}:${issue.line} -> ${issue.reason}`);
}
process.exit(1);
