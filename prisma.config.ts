import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl =
  process.env.PRISMA_MIGRATE_DATABASE_URL ||
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    "Falta PRISMA_MIGRATE_DATABASE_URL, DIRECT_DATABASE_URL o DATABASE_URL en .env"
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: datasourceUrl,
  },
});
