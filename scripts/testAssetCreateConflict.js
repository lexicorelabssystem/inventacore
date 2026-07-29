// scripts/testAssetCreateConflict.js
// Valida que POST /assets mapea conflictos unicos (P2002) a 409 con code estable.

if (typeof fetch !== "function") {
  throw new Error("Este script requiere Node 18+ (fetch global)");
}

const CENTRAL_EMAIL = process.env.TEST_CENTRAL_EMAIL || "";
const CENTRAL_PASSWORD = process.env.TEST_CENTRAL_PASSWORD || "";
let BASE_URL = process.env.API_BASE_URL || null;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function request(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const contentType = res.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { res, body, contentType };
}

async function login(email, password) {
  const out = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return {
    ...out,
    token: out.body?.token || null,
  };
}

async function authRequest(path, token, opts = {}) {
  const headers = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return request(path, { ...opts, headers });
}

async function setupServer() {
  if (BASE_URL) {
    return { close: async () => {} };
  }

  const { app } = require("../src/app");
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  BASE_URL = `http://127.0.0.1:${addr.port}`;
  console.log(`[setup] API local para test conflict: ${BASE_URL}`);

  return {
    close: async () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function buildP2002Error() {
  const err = new Error("Unique constraint failed on the (not available)");
  err.name = "PrismaClientKnownRequestError";
  err.code = "P2002";
  return err;
}

async function run() {
  console.log("[1] Login ADMIN_CENTRAL");
  const loginRes = await login(CENTRAL_EMAIL, CENTRAL_PASSWORD);
  assert(
    loginRes.res.ok && loginRes.token,
    `Login central fallo: ${loginRes.res.status} ${JSON.stringify(loginRes.body)}`
  );
  const token = loginRes.token;

  console.log("[2] Catalogos base");
  const statesRes = await authRequest("/catalog/asset-states?take=100", token);
  assert(statesRes.res.ok, `asset-states fallo: ${statesRes.res.status}`);
  const stateId = statesRes.body?.items?.find((s) => s.name === "BUENO")?.id;
  assert(stateId, "No existe estado BUENO");

  const typesRes = await authRequest("/catalog/asset-types?take=100", token);
  assert(typesRes.res.ok, `asset-types fallo: ${typesRes.res.status}`);
  const typeId = typesRes.body?.items?.[0]?.id;
  assert(typeId, "No existe assetType");

  const estRes = await authRequest("/catalog/establishments?take=100", token);
  assert(estRes.res.ok, `catalog establishments fallo: ${estRes.res.status}`);
  const establishments = estRes.body?.items || [];
  assert(establishments.length > 0, "No hay establecimientos activos");

  let establishmentId = null;
  let dependencyId = null;
  for (const est of establishments) {
    const depsRes = await authRequest(`/catalog/dependencies?establishmentId=${est.id}&take=100`, token);
    assert(depsRes.res.ok, `catalog dependencies fallo: ${depsRes.res.status}`);
    const deps = depsRes.body?.items || [];
    if (deps.length) {
      establishmentId = est.id;
      dependencyId = deps[0].id;
      break;
    }
  }
  assert(establishmentId && dependencyId, "No hay dependencia activa para probar create asset");

  const payload = {
    establishmentId,
    dependencyId,
    assetStateId: stateId,
    assetTypeId: typeId,
    name: `Test Conflict Asset ${Date.now()}`,
    accountingAccount: "ACC-TEST-CONFLICT",
    acquisitionValue: 1000,
    acquisitionDate: new Date().toISOString(),
  };

  console.log("[3] Forzar P2002 en tx.asset.create y validar 409 estable");
  const { prisma } = require("../src/prisma");
  const originalTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = async (input, ...rest) => {
    if (typeof input !== "function") {
      return originalTransaction(input, ...rest);
    }
    return originalTransaction(async (tx) => {
      const txProxy = new Proxy(tx, {
        get(target, prop, receiver) {
          if (prop === "asset") {
            const assetRepo = Reflect.get(target, prop, receiver);
            return new Proxy(assetRepo, {
              get(assetTarget, assetProp, assetReceiver) {
                if (assetProp === "create") {
                  return async () => {
                    throw buildP2002Error();
                  };
                }
                const value = Reflect.get(assetTarget, assetProp, assetReceiver);
                return typeof value === "function" ? value.bind(assetTarget) : value;
              },
            });
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return input(txProxy);
    }, ...rest);
  };

  try {
    const out = await authRequest("/assets", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert(out.res.status === 409, `Se esperaba 409, obtuvo ${out.res.status}`);
    assert(
      out.body?.code === "ASSET_INTERNAL_CODE_CONFLICT",
      `code inesperado: ${out.body?.code}`
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }

  console.log("OK: POST /assets conflicto unico => 409 + ASSET_INTERNAL_CODE_CONFLICT");
}

async function main() {
  const server = await setupServer();
  try {
    await run();
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error("Test asset conflict fallo:", err.message);
  process.exit(1);
});
