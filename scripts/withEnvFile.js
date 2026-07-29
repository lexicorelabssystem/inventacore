const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const [, , envFileArg, ...commandParts] = process.argv;

if (!envFileArg || commandParts.length === 0) {
  console.error("Uso: node scripts/withEnvFile.js <env-file> <comando> [args...]");
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), envFileArg);
if (!fs.existsSync(envPath)) {
  console.error(`No existe el archivo de entorno: ${envPath}`);
  process.exit(1);
}

const [command, ...args] = commandParts;
const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ENV_FILE: envPath,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("No se pudo ejecutar el comando:", error.message);
  process.exit(1);
});
