// src/server.js
const { env } = require("./config/env");
const { app } = require("./app");
const { prisma } = require("./prisma");

const PORT = env.PORT;
const HOST = env.HOST;
const server = app.listen(PORT, HOST, () => {
  console.log(`[API] Escuchando en ${HOST}:${PORT} (${env.NODE_ENV})`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[API] Puerto ${PORT} en uso. Cierra el proceso previo o cambia PORT.`);
  } else {
    console.error("[API] Error al iniciar servidor:", error.message);
  }
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[API] ${signal} recibido; iniciando cierre seguro`);

  const forceExit = setTimeout(() => {
    console.error("[API] Cierre seguro excedio 10 segundos");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  server.close(async (error) => {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("[API] Error al cerrar la conexion de base de datos:", disconnectError.message);
      process.exitCode = 1;
    }

    if (error) {
      console.error("[API] Error al cerrar el servidor:", error.message);
      process.exitCode = 1;
    }

    clearTimeout(forceExit);
    process.exit(process.exitCode || 0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
