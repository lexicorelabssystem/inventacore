// scripts/smokeAdminCrud.js
// Smoke API para ADMIN CRUD:
// - Guardas de baja logica (409 + code estable)
// - Reactivacion de inactivos

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
  console.log(`[setup] API local para smoke: ${BASE_URL}`);

  return {
    close: async () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function run() {
  console.log("[0] Health");
  const health = await request("/health");
  assert(health.res.ok, `Health fallo: ${health.res.status}`);

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
  const states = statesRes.body?.items || [];
  const bueno = states.find((s) => s.name === "BUENO");
  assert(bueno?.id, "No existe estado BUENO");

  const typesRes = await authRequest("/catalog/asset-types?take=100", token);
  assert(typesRes.res.ok, `asset-types fallo: ${typesRes.res.status}`);
  const types = typesRes.body?.items || [];
  const controlType = types.find((t) => t.name === "CONTROL") || types[0];
  assert(controlType?.id, "No existe AssetType para smoke");

  const estRes = await authRequest("/catalog/establishments?take=100", token);
  assert(estRes.res.ok, `catalog establishments fallo: ${estRes.res.status}`);
  const establishments = estRes.body?.items || [];
  assert(establishments.length > 0, "No hay establecimientos activos para smoke");

  let sourceEstablishment = null;
  let sourceDependencyId = null;
  for (const est of establishments) {
    const depsRes = await authRequest(
      `/catalog/dependencies?establishmentId=${est.id}&take=100`,
      token
    );
    assert(depsRes.res.ok, `catalog dependencies fallo: ${depsRes.res.status}`);
    const deps = depsRes.body?.items || [];
    if (deps.length > 0) {
      sourceEstablishment = est;
      sourceDependencyId = deps[0].id;
      break;
    }
  }
  assert(sourceEstablishment && sourceDependencyId, "No hay establishment con dependency activa");

  console.log("[3] Crear arbol temporal institution/establishment/dependency");
  const suffix = Date.now();
  const createInstitution = await authRequest("/admin/institutions", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Test Smoke Institution ${suffix}` }),
  });
  assert(
    createInstitution.res.status === 201,
    `Create institution fallo: ${createInstitution.res.status} ${JSON.stringify(
      createInstitution.body
    )}`
  );
  const institutionId = createInstitution.body.id;

  const createEstablishment = await authRequest("/admin/establishments", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Test Smoke Establishment ${suffix}`,
      type: "TEST",
      institutionId,
    }),
  });
  assert(
    createEstablishment.res.status === 201,
    `Create establishment fallo: ${createEstablishment.res.status} ${JSON.stringify(
      createEstablishment.body
    )}`
  );
  const establishmentId = createEstablishment.body.id;

  const createDependency = await authRequest("/admin/dependencies", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Test Smoke Dependency ${suffix}`,
      establishmentId,
    }),
  });
  assert(
    createDependency.res.status === 201,
    `Create dependency fallo: ${createDependency.res.status} ${JSON.stringify(
      createDependency.body
    )}`
  );
  const dependencyId = createDependency.body.id;

  console.log("[4] Validar guardas 409");
  const createGuardAsset = await authRequest("/assets", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      establishmentId: sourceEstablishment.id,
      dependencyId: sourceDependencyId,
      assetStateId: bueno.id,
      assetTypeId: controlType.id,
      name: `Test Smoke Guard Asset ${suffix}`,
      accountingAccount: "ACC-SMOKE",
      analyticCode: "AN-SMOKE",
      acquisitionValue: 1000,
      acquisitionDate: new Date().toISOString(),
    }),
  });
  assert(
    createGuardAsset.res.status === 201,
    `Create guard asset fallo: ${createGuardAsset.res.status} ${JSON.stringify(
      createGuardAsset.body
    )}`
  );

  const depGuard = await authRequest(`/admin/dependencies/${sourceDependencyId}`, token, {
    method: "DELETE",
  });
  assert(depGuard.res.status === 409, `Dependency guard debio ser 409: ${depGuard.res.status}`);
  assert(
    depGuard.body?.code === "DEPENDENCY_HAS_ACTIVE_ASSETS",
    `Dependency guard code inesperado: ${depGuard.body?.code}`
  );

  const estGuard = await authRequest(`/admin/establishments/${establishmentId}`, token, {
    method: "DELETE",
  });
  if (estGuard.res.status === 409) {
    assert(
      estGuard.body?.code === "ESTABLISHMENT_HAS_ACTIVE_DEPENDENCIES",
      `Establishment guard code inesperado: ${estGuard.body?.code}`
    );
  } else {
    assert(
      estGuard.res.status === 200,
      `Establishment guard debio ser 200 o 409: ${estGuard.res.status}`
    );
    assert(
      Number(estGuard.body?.autoDeactivatedDependencies || 0) > 0,
      "Establishment guard 200 no devolvio autoDeactivatedDependencies > 0"
    );
  }

  const instGuard = await authRequest(`/admin/institutions/${institutionId}`, token, {
    method: "DELETE",
  });
  if (instGuard.res.status === 409) {
    assert(
      instGuard.body?.code === "INSTITUTION_HAS_ACTIVE_ESTABLISHMENTS",
      `Institution guard code inesperado: ${instGuard.body?.code}`
    );
  } else {
    assert(
      instGuard.res.status === 200,
      `Institution guard debio ser 200 o 409: ${instGuard.res.status}`
    );
    assert(instGuard.body?.isActive === false, "Institution guard 200 no devolvio isActive=false");
  }

  console.log("[4.1] Validar plancheta con filtros de fecha");
  const today = new Date().toISOString().slice(0, 10);
  const planchetaOk = await authRequest(
    `/planchetas?establishmentId=${sourceEstablishment.id}&fromDate=${today}&toDate=${today}`,
    token
  );
  assert(
    planchetaOk.res.status === 200,
    `Plancheta con fechas validas debio ser 200: ${planchetaOk.res.status}`
  );

  const planchetaExcelOk = await authRequest(
    `/planchetas/excel?establishmentId=${sourceEstablishment.id}&fromDate=${today}&toDate=${today}`,
    token
  );
  assert(
    planchetaExcelOk.res.status === 200 || planchetaExcelOk.res.status === 404,
    `Plancheta excel con fechas validas debio ser 200/404: ${planchetaExcelOk.res.status}`
  );

  const planchetaPdfOk = await authRequest(
    `/planchetas/pdf?establishmentId=${sourceEstablishment.id}&fromDate=${today}&toDate=${today}`,
    token
  );
  assert(
    planchetaPdfOk.res.status === 200 || planchetaPdfOk.res.status === 404,
    `Plancheta pdf con fechas validas debio ser 200/404: ${planchetaPdfOk.res.status}`
  );

  const planchetaBadRange = await authRequest(
    `/planchetas?establishmentId=${sourceEstablishment.id}&fromDate=2026-12-31&toDate=2026-01-01`,
    token
  );
  assert(
    planchetaBadRange.res.status === 400,
    `Plancheta con rango invalido debio ser 400: ${planchetaBadRange.res.status}`
  );

  const planchetaBadFormat = await authRequest(
    `/planchetas?establishmentId=${sourceEstablishment.id}&fromDate=31-12-2026`,
    token
  );
  assert(
    planchetaBadFormat.res.status === 400,
    `Plancheta con formato invalido debio ser 400: ${planchetaBadFormat.res.status}`
  );

  console.log("[5] Validar reactivacion de inactivos");
  const depDown = await authRequest(`/admin/dependencies/${dependencyId}`, token, {
    method: "DELETE",
  });
  if (depDown.res.status === 409) {
    assert(
      depDown.body?.code === "DEPENDENCY_ALREADY_INACTIVE",
      `Dependency down code inesperado: ${depDown.body?.code}`
    );
  } else {
    assert(
      depDown.res.ok && depDown.body?.isActive === false,
      "No se pudo bajar dependency temporal"
    );
  }
  const depUp = await authRequest(`/admin/dependencies/${dependencyId}/reactivate`, token, {
    method: "PUT",
  });
  assert(depUp.res.ok && depUp.body?.isActive === true, "No se pudo reactivar dependency temporal");

  const depDown2 = await authRequest(`/admin/dependencies/${dependencyId}`, token, {
    method: "DELETE",
  });
  assert(
    depDown2.res.ok && depDown2.body?.isActive === false,
    "No se pudo bajar dependency temporal (2)"
  );
  const estDown = await authRequest(`/admin/establishments/${establishmentId}`, token, {
    method: "DELETE",
  });
  if (estDown.res.status === 409) {
    assert(
      estDown.body?.code === "ESTABLISHMENT_ALREADY_INACTIVE",
      `Establishment down code inesperado: ${estDown.body?.code}`
    );
  } else {
    assert(
      estDown.res.ok && estDown.body?.isActive === false,
      "No se pudo bajar establishment temporal"
    );
  }
  const estUp = await authRequest(`/admin/establishments/${establishmentId}/reactivate`, token, {
    method: "PUT",
  });
  assert(
    estUp.res.ok && estUp.body?.isActive === true,
    "No se pudo reactivar establishment temporal"
  );

  const estDown2 = await authRequest(`/admin/establishments/${establishmentId}`, token, {
    method: "DELETE",
  });
  assert(
    estDown2.res.ok && estDown2.body?.isActive === false,
    "No se pudo bajar establishment temporal (2)"
  );
  const instDown = await authRequest(`/admin/institutions/${institutionId}`, token, {
    method: "DELETE",
  });
  if (instDown.res.status === 409) {
    assert(
      instDown.body?.code === "INSTITUTION_ALREADY_INACTIVE",
      `Institution down code inesperado: ${instDown.body?.code}`
    );
  } else {
    assert(
      instDown.res.ok && instDown.body?.isActive === false,
      "No se pudo bajar institution temporal"
    );
  }
  const instUp = await authRequest(`/admin/institutions/${institutionId}/reactivate`, token, {
    method: "PUT",
  });
  assert(
    instUp.res.ok && instUp.body?.isActive === true,
    "No se pudo reactivar institution temporal"
  );

  console.log("OK: smoke admin CRUD (guardas + reactivacion)");
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
  console.error("Smoke admin CRUD fallo:", err.message);
  process.exit(1);
});


