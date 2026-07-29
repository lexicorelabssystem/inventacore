#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function resolveDatabaseUrl() {
  return (
    argValue("--database-url") ||
    process.env.RESTORE_DATABASE_URL ||
    process.env.DIRECT_DATABASE_URL ||
    process.env.DATABASE_URL
  );
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} finalizo con codigo ${code}`));
    });
  });
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "Falta RESTORE_DATABASE_URL, DIRECT_DATABASE_URL o DATABASE_URL en .env"
    );
  }

  const fileArg = argValue("--file");
  if (!fileArg) {
    throw new Error("Uso: npm run db:restore -- --file <ruta_backup.dump|ruta.sql>");
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    const backupsDir = path.join(process.cwd(), "backups");
    const availableFiles = fs.existsSync(backupsDir)
      ? fs.readdirSync(backupsDir).filter((name) => {
          const fullPath = path.join(backupsDir, name);
          return fs.statSync(fullPath).isFile();
        })
      : [];

    const availableMessage = availableFiles.length
      ? `Archivos disponibles en backups/: ${availableFiles.join(", ")}`
      : "No hay archivos disponibles en backups/.";

    throw new Error(`No existe el archivo de backup: ${filePath}. ${availableMessage}`);
  }

  const isSql = filePath.toLowerCase().endsWith(".sql");
  const resetSchema = hasFlag("--reset-schema");
  const clean = hasFlag("--clean") && !resetSchema;

  if (resetSchema) {
    console.log("[restore] reiniciando schema public");
    await run(
      "psql",
      [
        "-d",
        databaseUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
      ],
      process.env
    );
  }

  if (isSql) {
    console.log(`[restore] restaurando SQL: ${filePath}`);
    await run("psql", ["-d", databaseUrl, "-f", filePath], process.env);
    console.log("[restore] OK");
    return;
  }

  const args = [
    "--no-owner",
    "--no-privileges",
    ...(clean ? ["--clean", "--if-exists"] : []),
    "--dbname",
    databaseUrl,
    filePath,
  ];

  console.log(`[restore] restaurando dump: ${filePath}`);
  await run("pg_restore", args, process.env);
  console.log("[restore] OK");
}

main().catch((err) => {
  console.error(`[restore] ERROR: ${err.message}`);
  process.exit(1);
});
