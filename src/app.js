const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const { assetsRouter } = require("./routes/assets");
const { auditRouter } = require("./routes/audit");
const { authRouter } = require("./routes/auth");
const { planchetasRouter } = require("./routes/planchetas");
const { catalogRouter } = require("./routes/catalog");
const { adminCrudRouter } = require("./routes/adminCrud");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/logger");
const { prisma } = require("./prisma");
const { version: appVersion } = require("../package.json");

const { env } = require("./config/env");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy:
      env.NODE_ENV === "production"
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'none'"],
              formAction: ["'none'"],
            },
          }
        : false,
    hsts: env.NODE_ENV === "production",
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "same-site" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
  })
);
app.use(compression());
const corsOrigins = env.CORS_ORIGIN
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOriginMatcher(patterns) {
  if (patterns.includes("*")) return () => true;

  const regexPatterns = patterns
    .filter((pattern) => pattern.includes("*"))
    .map((pattern) => new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`));
  const exactPatterns = new Set(patterns.filter((pattern) => !pattern.includes("*")));

  return (origin) => {
    if (!origin) return true;
    if (exactPatterns.has(origin)) return true;
    return regexPatterns.some((re) => re.test(origin));
  };
}

const isCorsOriginAllowed = buildOriginMatcher(corsOrigins);

app.use(
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`CORS_BLOCKED_ORIGIN:${origin || "unknown"}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(requestLogger());
app.use((req, res, next) => {
  if (req.id) {
    res.setHeader("X-Request-Id", String(req.id));
  }
  next();
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 1500 : 1200,
  standardHeaders: true,
  legacyHeaders: false,
  skip(req) {
    return (
      req.method === "OPTIONS" ||
      req.path === "/" ||
      req.path === "/health" ||
      req.path === "/ready" ||
      req.path === "/metrics" ||
      req.path === "/metrics/prometheus" ||
      req.path === "/api/health" ||
      req.path === "/api/ready" ||
      req.path === "/api/metrics" ||
      req.path === "/api/metrics/prometheus"
    );
  },
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
});

app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "inventario-api",
    version: appVersion,
    docs: {
      health: "/health",
      ready: "/ready",
      metrics: "/metrics",
    },
    time: new Date().toISOString(),
  });
});

app.get("/ready", async (req, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("READINESS_DB_TIMEOUT")), 3000)
      ),
    ]);

    res.json({
      ok: true,
      ready: true,
      db: "up",
      requestId: req.id || null,
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      ready: false,
      db: "down",
      code: error?.message === "READINESS_DB_TIMEOUT" ? "READINESS_DB_TIMEOUT" : "READINESS_DB_DOWN",
      requestId: req.id || null,
      time: new Date().toISOString(),
    });
  }
});

async function collectOperationalMetrics() {
  const startedAt = Date.now();
  let db = { ok: false, latencyMs: null, code: null };
  let ok = true;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("METRICS_DB_TIMEOUT")), 3000)
      ),
    ]);
    db = { ok: true, latencyMs: Date.now() - startedAt, code: null };
  } catch (error) {
    ok = false;
    db = {
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: error?.message === "METRICS_DB_TIMEOUT" ? "METRICS_DB_TIMEOUT" : "METRICS_DB_DOWN",
    };
  }

  const mem = process.memoryUsage();
  return {
    ok,
    time: new Date().toISOString(),
    service: {
      name: "inventario-api",
      version: appVersion,
      node: process.version,
      env: env.NODE_ENV,
      uptimeSec: Math.round(process.uptime()),
    },
    memory: {
      rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      externalMb: Number((mem.external / 1024 / 1024).toFixed(2)),
    },
    db,
  };
}

function escapePromLabel(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

app.get("/metrics", async (req, res) => {
  const payload = await collectOperationalMetrics();
  payload.requestId = req.id || null;
  const status = payload.ok ? 200 : 503;
  if (!payload.ok) payload.code = payload.db.code;
  res.status(status).json(payload);
});

app.get("/metrics/prometheus", async (req, res) => {
  const payload = await collectOperationalMetrics();
  const uptime = Number(payload.service.uptimeSec || 0);
  const rssBytes = Math.round((payload.memory.rssMb || 0) * 1024 * 1024);
  const heapUsedBytes = Math.round((payload.memory.heapUsedMb || 0) * 1024 * 1024);
  const heapTotalBytes = Math.round((payload.memory.heapTotalMb || 0) * 1024 * 1024);
  const externalBytes = Math.round((payload.memory.externalMb || 0) * 1024 * 1024);
  const dbUp = payload.db?.ok ? 1 : 0;
  const dbLatencyMs = Number(payload.db?.latencyMs || 0);

  const lines = [
    "# HELP inventario_uptime_seconds Process uptime in seconds",
    "# TYPE inventario_uptime_seconds gauge",
    `inventario_uptime_seconds ${uptime}`,
    "# HELP inventario_process_resident_memory_bytes Resident set size in bytes",
    "# TYPE inventario_process_resident_memory_bytes gauge",
    `inventario_process_resident_memory_bytes ${rssBytes}`,
    "# HELP inventario_process_heap_used_bytes Used JS heap in bytes",
    "# TYPE inventario_process_heap_used_bytes gauge",
    `inventario_process_heap_used_bytes ${heapUsedBytes}`,
    "# HELP inventario_process_heap_total_bytes Total JS heap in bytes",
    "# TYPE inventario_process_heap_total_bytes gauge",
    `inventario_process_heap_total_bytes ${heapTotalBytes}`,
    "# HELP inventario_process_external_bytes External memory in bytes",
    "# TYPE inventario_process_external_bytes gauge",
    `inventario_process_external_bytes ${externalBytes}`,
    "# HELP inventario_db_up Database reachability status (1=up,0=down)",
    "# TYPE inventario_db_up gauge",
    `inventario_db_up ${dbUp}`,
    "# HELP inventario_db_latency_ms Database ping latency in milliseconds",
    "# TYPE inventario_db_latency_ms gauge",
    `inventario_db_latency_ms ${dbLatencyMs}`,
    "# HELP inventario_build_info Build and runtime metadata",
    "# TYPE inventario_build_info gauge",
    `inventario_build_info{service="${escapePromLabel(payload.service.name)}",version="${escapePromLabel(payload.service.version)}",node="${escapePromLabel(payload.service.node)}",env="${escapePromLabel(payload.service.env)}"} 1`,
  ];

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(payload.ok ? 200 : 503).send(`${lines.join("\n")}\n`);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/ready", async (req, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("READINESS_DB_TIMEOUT")), 3000)
      ),
    ]);

    res.json({
      ok: true,
      ready: true,
      db: "up",
      requestId: req.id || null,
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      ready: false,
      db: "down",
      code: error?.message === "READINESS_DB_TIMEOUT" ? "READINESS_DB_TIMEOUT" : "READINESS_DB_DOWN",
      requestId: req.id || null,
      time: new Date().toISOString(),
    });
  }
});

app.get("/api/metrics", async (req, res) => {
  const payload = await collectOperationalMetrics();
  payload.requestId = req.id || null;
  const status = payload.ok ? 200 : 503;
  if (!payload.ok) payload.code = payload.db.code;
  res.status(status).json(payload);
});

app.get("/api/metrics/prometheus", async (req, res) => {
  const payload = await collectOperationalMetrics();
  const uptime = Number(payload.service.uptimeSec || 0);
  const rssBytes = Math.round((payload.memory.rssMb || 0) * 1024 * 1024);
  const heapUsedBytes = Math.round((payload.memory.heapUsedMb || 0) * 1024 * 1024);
  const heapTotalBytes = Math.round((payload.memory.heapTotalMb || 0) * 1024 * 1024);
  const externalBytes = Math.round((payload.memory.externalMb || 0) * 1024 * 1024);
  const dbUp = payload.db?.ok ? 1 : 0;
  const dbLatencyMs = Number(payload.db?.latencyMs || 0);

  const lines = [
    "# HELP inventario_uptime_seconds Process uptime in seconds",
    "# TYPE inventario_uptime_seconds gauge",
    `inventario_uptime_seconds ${uptime}`,
    "# HELP inventario_process_resident_memory_bytes Resident set size in bytes",
    "# TYPE inventario_process_resident_memory_bytes gauge",
    `inventario_process_resident_memory_bytes ${rssBytes}`,
    "# HELP inventario_process_heap_used_bytes Used JS heap in bytes",
    "# TYPE inventario_process_heap_used_bytes gauge",
    `inventario_process_heap_used_bytes ${heapUsedBytes}`,
    "# HELP inventario_process_heap_total_bytes Total JS heap in bytes",
    "# TYPE inventario_process_heap_total_bytes gauge",
    `inventario_process_heap_total_bytes ${heapTotalBytes}`,
    "# HELP inventario_process_external_bytes External memory in bytes",
    "# TYPE inventario_process_external_bytes gauge",
    `inventario_process_external_bytes ${externalBytes}`,
    "# HELP inventario_db_up Database reachability status (1=up,0=down)",
    "# TYPE inventario_db_up gauge",
    `inventario_db_up ${dbUp}`,
    "# HELP inventario_db_latency_ms Database ping latency in milliseconds",
    "# TYPE inventario_db_latency_ms gauge",
    `inventario_db_latency_ms ${dbLatencyMs}`,
    "# HELP inventario_build_info Build and runtime metadata",
    "# TYPE inventario_build_info gauge",
    `inventario_build_info{service="${escapePromLabel(payload.service.name)}",version="${escapePromLabel(payload.service.version)}",node="${escapePromLabel(payload.service.node)}",env="${escapePromLabel(payload.service.env)}"} 1`,
  ];

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(payload.ok ? 200 : 503).send(`${lines.join("\n")}\n`);
});

// Route-level rate limits
app.use(
  "/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos, intenta mas tarde" },
  })
);
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos, intenta mas tarde" },
  })
);

app.use(
  "/auth/login",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 10 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos de login, espera 10 minutos" },
  })
);
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 10 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos de login, espera 10 minutos" },
  })
);
app.use(
  "/admin",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 300 : 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  "/api/admin",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 300 : 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  "/audit",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 120 : 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  "/api/audit",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 120 : 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  "/assets/import/excel",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 10 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas importaciones, intenta mas tarde" },
  })
);
app.use(
  "/api/assets/import/excel",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 10 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas importaciones, intenta mas tarde" },
  })
);
app.use(
  "/assets/export",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas exportaciones, intenta mas tarde" },
  })
);
app.use(
  "/api/assets/export",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas exportaciones, intenta mas tarde" },
  })
);
app.use(
  "/planchetas/excel",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas exportaciones, intenta mas tarde" },
  })
);
app.use(
  "/api/planchetas/excel",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas exportaciones, intenta mas tarde" },
  })
);
app.use(
  "/planchetas/pdf",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas exportaciones, intenta mas tarde" },
  })
);
app.use(
  "/api/planchetas/pdf",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas exportaciones, intenta mas tarde" },
  })
);

app.use("/assets", assetsRouter);
app.use("/auth", authRouter);
app.use("/audit", auditRouter);
app.use("/planchetas", planchetasRouter);
app.use("/catalog", catalogRouter);
app.use("/admin", adminCrudRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/auth", authRouter);
app.use("/api/audit", auditRouter);
app.use("/api/planchetas", planchetasRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/admin", adminCrudRouter);

app.use(notFound);
app.use(errorHandler);
module.exports = { app };
