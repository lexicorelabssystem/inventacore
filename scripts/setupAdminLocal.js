const fs = require("node:fs");
const path = require("node:path");

function copyIfMissing(sourceRelativePath, targetRelativePath) {
  const sourcePath = path.resolve(process.cwd(), sourceRelativePath);
  const targetPath = path.resolve(process.cwd(), targetRelativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No existe plantilla requerida: ${sourceRelativePath}`);
  }

  if (fs.existsSync(targetPath)) {
    console.log(`[OK] Ya existe ${targetRelativePath}`);
    return false;
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[CREADO] ${targetRelativePath} (desde ${sourceRelativePath})`);
  return true;
}

try {
  copyIfMissing(".env.admin.example", ".env.admin.local");
  copyIfMissing("frontend/.env.admin.example", "frontend/.env.admin.local");

  console.log("");
  console.log("Siguiente paso:");
  console.log("1) Edita .env.admin.local con tu BD exclusiva de trabajo.");
  console.log("2) Ejecuta npm run admin:doctor");
  console.log("3) Ejecuta npm run admin:prisma:deploy");
  console.log("4) Inicia con npm run admin:dev");
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
}
