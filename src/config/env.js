const { loadEnv } = require("./loadEnv");

loadEnv();

function requireEnv(name, opts = {}) {
  const val = process.env[name];
  if (!val) {
    if (opts.optional) return undefined;
    throw new Error(`Falta ${name} en variables de entorno`);
  }
  return val;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "strict").toLowerCase();
const PORT = Number(process.env.PORT || 3000);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
const CORS_ORIGIN = process.env.CORS_ORIGIN || (NODE_ENV === "production" ? "" : "*");

if (!["development", "test", "production"].includes(NODE_ENV)) {
  throw new Error("NODE_ENV debe ser development, test o production");
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT debe ser un entero entre 1 y 65535");
}

if (!Number.isInteger(REFRESH_TOKEN_TTL_DAYS) || REFRESH_TOKEN_TTL_DAYS < 1) {
  throw new Error("REFRESH_TOKEN_TTL_DAYS debe ser un entero mayor o igual a 1");
}

if (!["strict", "lax", "none"].includes(COOKIE_SAMESITE)) {
  throw new Error("COOKIE_SAMESITE debe ser strict, lax o none");
}

if (COOKIE_SAMESITE === "none" && process.env.COOKIE_SECURE !== "true" && NODE_ENV === "production") {
  throw new Error("COOKIE_SECURE=true es obligatorio cuando COOKIE_SAMESITE=none en production");
}

const env = {
  NODE_ENV,
  PORT,
  HOST: process.env.HOST || "0.0.0.0",
  JWT_SECRET:
    NODE_ENV === "production"
      ? requireEnv("JWT_SECRET")
      : requireEnv("JWT_SECRET", { optional: true }) || "dev_secret",
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  UTM_VALUE_CLP: Number(process.env.UTM_VALUE_CLP || 0),
  CORS_ORIGIN,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "15m",
  REFRESH_TOKEN_TTL_DAYS,
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SAMESITE,
};

if (!env.DIRECT_DATABASE_URL && !env.DATABASE_URL) {
  throw new Error("Falta DIRECT_DATABASE_URL o DATABASE_URL en .env");
}

if (NODE_ENV === "production") {
  if (!env.CORS_ORIGIN) {
    throw new Error("CORS_ORIGIN es obligatorio en production");
  }
  const productionOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  for (const origin of productionOrigins) {
    if (!origin || origin.includes("*")) {
      throw new Error("CORS_ORIGIN no permite valores vacios ni comodines en production");
    }
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contiene una URL invalida: ${origin}`);
    }
    if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
      throw new Error(`CORS_ORIGIN debe contener origenes http/https sin rutas: ${origin}`);
    }
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres en production");
  }
}

module.exports = { env };
