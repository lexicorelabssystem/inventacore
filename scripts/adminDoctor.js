const { loadEnv } = require("../src/config/loadEnv");

function main() {
  const envInfo = loadEnv();
  const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";

  console.log("=== ADMIN LOCAL DOCTOR ===");
  console.log(`ENV_FILE: ${envInfo.envPath}`);
  console.log(`DB Host: ${envInfo.dbHost || "no-detectado"}`);
  console.log(`DB Local: ${envInfo.isLocalDb ? "SI" : "NO"}`);
  console.log(`Puerto API: ${process.env.PORT || "3000"}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`ENFORCE_LOCAL_DB: ${process.env.ENFORCE_LOCAL_DB || "false"}`);
  console.log(
    `FISCAL_ASSET_LIFECYCLE_STRICT: ${process.env.FISCAL_ASSET_LIFECYCLE_STRICT || "false"}`
  );

  if (!dbUrl) {
    throw new Error("No hay DATABASE_URL ni DIRECT_DATABASE_URL");
  }

  if (!envInfo.isLocalDb) {
    throw new Error("BD no local detectada. Ajusta la URL a localhost antes de continuar.");
  }
}

try {
  main();
} catch (error) {
  console.error(`[ADMIN-DOCTOR] ${error.message}`);
  process.exit(1);
}
