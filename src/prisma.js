const { env } = require("./config/env");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

function normalizeConnectionString(raw) {
  if (!raw) return raw;

  // In local/dev with pg v8, sslmode=require can behave like verify-full and fail
  // against some poolers/intermediaries. Keep production strict by default.
  if ((env.NODE_ENV || "development") === "production") return raw;

  try {
    const url = new URL(raw);
    const sslMode = (url.searchParams.get("sslmode") || "").toLowerCase();
    const hasCompat = url.searchParams.has("uselibpqcompat");

    if (sslMode === "require" && !hasCompat) {
      url.searchParams.set("uselibpqcompat", "true");
      return url.toString();
    }

    return raw;
  } catch {
    return raw;
  }
}

const connectionString = normalizeConnectionString(
  env.DIRECT_DATABASE_URL || env.DATABASE_URL
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

module.exports = { prisma };
