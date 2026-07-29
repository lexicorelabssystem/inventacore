const { loadEnv } = require("../src/config/loadEnv");

loadEnv();

const PLACEHOLDER_MARKERS = ["replace_with", "example.invalid", "user:pass", "<", ">"];

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function parsePostgresIdentity(raw, name) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} no es una URL valida`);
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${name} debe usar postgres:// o postgresql://`);
  }
  if (!parsed.hostname) throw new Error(`${name} no contiene host`);

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
  if (!database) throw new Error(`${name} no contiene nombre de base de datos`);

  const normalizedRaw = raw.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((marker) => normalizedRaw.includes(marker))) {
    throw new Error(`${name} contiene valores de ejemplo o marcadores sin reemplazar`);
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database,
    sslMode: parsed.searchParams.get("sslmode") || "no-indicado",
  };
}

function sameDatabase(left, right) {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.database.toLowerCase() === right.database.toLowerCase()
  );
}

function main() {
  const label = requireEnv("NEW_DATABASE_LABEL");
  const confirmation = requireEnv("NEW_DATABASE_CONFIRM");
  if (confirmation !== `NUEVA:${label}`) {
    throw new Error("NEW_DATABASE_CONFIRM no coincide con NUEVA:<NEW_DATABASE_LABEL>");
  }

  const target = parsePostgresIdentity(requireEnv("NEW_DATABASE_URL"), "NEW_DATABASE_URL");
  const existing = parsePostgresIdentity(
    requireEnv("EXISTING_DATABASE_URL"),
    "EXISTING_DATABASE_URL"
  );

  if (sameDatabase(target, existing)) {
    throw new Error("BLOQUEADO: la base nueva coincide con la base existente");
  }

  const allowSameHost = String(process.env.ALLOW_SAME_DATABASE_HOST || "false").toLowerCase() === "true";
  if (target.host === existing.host && !allowSameHost) {
    throw new Error(
      "BLOQUEADO: ambas bases usan el mismo host. Usa un servicio PostgreSQL independiente o autoriza explicitamente ALLOW_SAME_DATABASE_HOST=true"
    );
  }

  console.log("NEW DATABASE PREFLIGHT OK");
  console.table({
    label,
    host: target.host,
    port: target.port,
    database: target.database,
    sslMode: target.sslMode,
    separateHost: target.host !== existing.host ? "SI" : "NO (autorizado)",
  });
  console.log("No se realizo ninguna conexion ni se mostraron credenciales.");
}

try {
  main();
} catch (error) {
  console.error(`[NEW-DB-PREFLIGHT] ${error.message}`);
  process.exit(1);
}
