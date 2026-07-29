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

function forwardFlags() {
  const args = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--latest") continue;
    if (arg === "--dir") {
      i += 1;
      continue;
    }
    args.push(arg);
  }
  return args;
}

function findLatestBackup(dir) {
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((fullPath) => fs.statSync(fullPath).isFile())
    .filter((fullPath) => /\.(dump|sql)$/i.test(fullPath));

  if (!files.length) return null;

  return files
    .map((fullPath) => ({
      fullPath,
      mtimeMs: fs.statSync(fullPath).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].fullPath;
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
  const backupsDir = path.resolve(argValue("--dir") || "backups");
  const latest = findLatestBackup(backupsDir);
  if (!latest) {
    throw new Error(`No se encontraron backups en ${backupsDir}`);
  }

  console.log(`[restore-latest] usando backup mas reciente: ${latest}`);

  const forwardedArgs = forwardFlags();
  if (!forwardedArgs.includes("--file")) {
    forwardedArgs.push("--file", latest);
  }

  const restoreScript = path.join(process.cwd(), "scripts", "dbRestore.js");
  await run("node", [restoreScript, ...forwardedArgs], process.env);
}

main().catch((err) => {
  console.error(`[restore-latest] ERROR: ${err.message}`);
  process.exit(1);
});
