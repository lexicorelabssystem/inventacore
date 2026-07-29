const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

let loadedEnv = null;

function parseDatabaseHost(connectionString) {
  if (!connectionString) return null;
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalDbHost(hostname) {
  if (!hostname) return false;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function loadEnv() {
  if (loadedEnv) return loadedEnv;

  const envFile = process.env.ENV_FILE || ".env";
  const envPath = path.resolve(process.cwd(), envFile);

  if (process.env.ENV_FILE && !fs.existsSync(envPath)) {
    throw new Error(`No existe ENV_FILE en la ruta: ${envPath}`);
  }

  dotenv.config({ path: envPath, quiet: true });

  const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";
  const dbHost = parseDatabaseHost(dbUrl);
  const enforceLocalDb = (process.env.ENFORCE_LOCAL_DB || "false").toLowerCase() === "true";

  if (enforceLocalDb && !isLocalDbHost(dbHost)) {
    throw new Error(
      `ENFORCE_LOCAL_DB=true exige una BD local. Host detectado: ${dbHost || "no-detectado"}. ` +
      `Actualiza DATABASE_URL/DIRECT_DATABASE_URL en ${envFile} para usar localhost.`
    );
  }

  loadedEnv = {
    envFile,
    envPath,
    dbHost,
    isLocalDb: isLocalDbHost(dbHost),
  };
  return loadedEnv;
}

module.exports = { loadEnv };
