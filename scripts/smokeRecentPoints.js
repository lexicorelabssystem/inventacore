// scripts/smokeRecentPoints.js
// Smoke puntual de cambios recientes:
// 1) Update establecimiento (rbd/commune) persiste
// 2) Baja establecimiento + summary de force delete trae detalle de dependencias/ramas
// 3) Hard delete normal bloquea con HAS_RELATIONS y force delete funciona

if (typeof fetch !== "function") {
  throw new Error("Este script requiere Node 18+ (fetch global)");
}

const CENTRAL_EMAIL = process.env.TEST_CENTRAL_EMAIL || "";
const CENTRAL_PASSWORD = process.env.TEST_CENTRAL_PASSWORD || "";
let BASE_URL = process.env.API_BASE_URL || null;

const CONFIRM_FORCE = "ELIMINAR DEFINITIVO";

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

async function authRequest(path, token, opts = {}) {
  const headers = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return request(path, { ...opts, headers });
}

async function loginCentral() {
  const out = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CENTRAL_EMAIL, password: CENTRAL_PASSWORD }),
  });
  assert(
    out.res.ok && out.body?.token,
    `Login central fallo: ${out.res.status} ${JSON.stringify(out.body)}`
  );
  return out.body.token;
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
  console.log(`[setup] API local para smoke puntual: ${BASE_URL}`);
  return {
    close: async () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function ensureInactive(entity, id, token) {
  if (!id) return;
  const down = await authRequest(`/admin/${entity}/${id}`, token, { method: "DELETE" });
  if (down.res.ok) return;
  if (down.res.status === 409) return;
  throw new Error(`No se pudo dar de baja ${entity} ${id}: ${down.res.status}`);
}

async function run() {
  const token = await loginCentral();
  const suffix = Date.now();

  let institutionId = null;
  let establishmentId = null;
  let dependencyId = null;

  try {
    console.log("[1] Crear arbol temporal");
    const instCreate = await authRequest("/admin/institutions", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `SMOKE FIXES INST ${suffix}` }),
    });
    assert(instCreate.res.status === 201, `Create institution fallo: ${instCreate.res.status}`);
    institutionId = Number(instCreate.body.id);

    const estCreate = await authRequest("/admin/establishments", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `SMOKE FIXES EST ${suffix}`,
        type: "SMOKE",
        rbd: `RBD-${suffix}`,
        commune: "COMUNA-INICIAL",
        institutionId,
      }),
    });
    assert(estCreate.res.status === 201, `Create establishment fallo: ${estCreate.res.status}`);
    establishmentId = Number(estCreate.body.id);

    const depCreate = await authRequest("/admin/dependencies", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `SMOKE FIXES DEP ${suffix}`,
        establishmentId,
      }),
    });
    assert(depCreate.res.status === 201, `Create dependency fallo: ${depCreate.res.status}`);
    dependencyId = Number(depCreate.body.id);

    console.log("[2] Validar update establecimiento (rbd/commune)");
    const estUpdate = await authRequest(`/admin/establishments/${establishmentId}`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rbd: `RBD-UPD-${suffix}`,
        commune: "COMUNA-ACTUALIZADA",
        type: "SMOKE-UPD",
      }),
    });
    assert(estUpdate.res.ok, `Update establishment fallo: ${estUpdate.res.status}`);

    const estGet = await authRequest(`/admin/establishments/${establishmentId}`, token);
    assert(estGet.res.ok, `Get establishment fallo: ${estGet.res.status}`);
    assert(
      estGet.body?.rbd === `RBD-UPD-${suffix}`,
      `rbd no persistio. actual=${estGet.body?.rbd}`
    );
    assert(
      estGet.body?.commune === "COMUNA-ACTUALIZADA",
      `commune no persistio. actual=${estGet.body?.commune}`
    );

    console.log("[3] Dar de baja establecimiento y validar deactivacion dependencias");
    const estDown = await authRequest(`/admin/establishments/${establishmentId}`, token, {
      method: "DELETE",
    });
    assert(estDown.res.ok, `Baja establishment fallo: ${estDown.res.status}`);
    assert(
      Number(estDown.body?.autoDeactivatedDependencies || 0) >= 1,
      "No se reporto autoDeactivatedDependencies en baja de establishment"
    );

    console.log("[4] Validar summary de force delete con detalles");
    const summary = await authRequest(
      `/admin/establishments/${establishmentId}/permanent/summary`,
      token
    );
    assert(summary.res.ok, `Summary establishment fallo: ${summary.res.status}`);
    assert(summary.body?.summary, "Summary establishment no devolvio summary");
    assert(
      Array.isArray(summary.body?.details?.dependencies),
      "Summary establishment no devolvio details.dependencies[]"
    );
    const depInSummary = summary.body.details.dependencies.find((d) => Number(d.id) === dependencyId);
    assert(depInSummary, "Dependency temporal no aparece en details.dependencies");

    console.log("[5] Validar bloqueo de hard delete normal por relaciones");
    const hardDelete = await authRequest(`/admin/establishments/${establishmentId}/permanent`, token, {
      method: "DELETE",
    });
    assert(
      hardDelete.res.status === 409,
      `Hard delete normal debio ser 409 y fue ${hardDelete.res.status}`
    );
    assert(
      hardDelete.body?.code === "ESTABLISHMENT_HARD_DELETE_HAS_RELATIONS",
      `Code inesperado hard delete normal: ${hardDelete.body?.code}`
    );

    console.log("[6] Force delete establecimiento");
    const forceDelete = await authRequest(
      `/admin/establishments/${establishmentId}/permanent/force`,
      token,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationText: CONFIRM_FORCE }),
      }
    );
    assert(forceDelete.res.ok, `Force delete establishment fallo: ${forceDelete.res.status}`);

    console.log("[7] Limpiar institucion temporal");
    await ensureInactive("institutions", institutionId, token);
    const instPermanent = await authRequest(`/admin/institutions/${institutionId}/permanent`, token, {
      method: "DELETE",
    });
    if (!instPermanent.res.ok) {
      const instForce = await authRequest(
        `/admin/institutions/${institutionId}/permanent/force`,
        token,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationText: CONFIRM_FORCE }),
        }
      );
      assert(instForce.res.ok, `Force delete institution fallo: ${instForce.res.status}`);
    }

    console.log("OK: smoke de puntos recientes");
  } finally {
    // limpieza best-effort si quedo algo intermedio
    if (!token) return;
    try {
      if (establishmentId) {
        await ensureInactive("establishments", establishmentId, token);
        await authRequest(`/admin/establishments/${establishmentId}/permanent/force`, token, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationText: CONFIRM_FORCE }),
        });
      }
    } catch {}
    try {
      if (institutionId) {
        await ensureInactive("institutions", institutionId, token);
        await authRequest(`/admin/institutions/${institutionId}/permanent/force`, token, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationText: CONFIRM_FORCE }),
        });
      }
    } catch {}
  }
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
  console.error("Smoke puntos recientes fallo:", err.message);
  process.exit(1);
});
