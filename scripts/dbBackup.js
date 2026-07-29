#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

function pad(n) {
  return String(n).padStart(2, "0");
}

function timestamp() {
  const d = new Date();
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function resolveDatabaseUrl() {
  return (
    argValue("--database-url") ||
    process.env.BACKUP_DATABASE_URL ||
    process.env.DIRECT_DATABASE_URL ||
    process.env.DATABASE_URL
  );
}

function isRenderUrl(raw) {
  try {
    const url = new URL(raw);
    return /render\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
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
      "Falta BACKUP_DATABASE_URL, DIRECT_DATABASE_URL o DATABASE_URL en .env"
    );
  }

  const outArg = argValue("--out");
  const outDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile =
    outArg ||
    path.join(outDir, `inventario_backup_${timestamp()}.dump`);

  const args = [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    outFile,
    "--dbname",
    databaseUrl,
  ];

  console.log(`[backup] creando respaldo en: ${outFile}`);
  try {
    await run("pg_dump", args, process.env);
  } catch (error) {
    if (isRenderUrl(databaseUrl)) {
      console.error(
        "[backup] Tip: si esta DB de Render sigue cortando SSL desde tu PC, prueba ejecutar el backup desde un servicio/one-off job dentro de Render o verifica la URL externa exacta y las reglas de red."
      );
    }
    throw error;
  }
  console.log("[backup] OK");
}

main().catch((err) => {
  console.error(`[backup] ERROR: ${err.message}`);
  process.exit(1);
});
