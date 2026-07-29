// scripts/criticalSuite.js
// Suite critica E2E para flujos obligatorios:
// - Auth: login/refresh/logout + usuario inactivo
// - Usuarios: create/update/deactivate/list includeInactive
// - Assets: create/transfer/status/restore
// - Importacion: catalogo y assets
require("dotenv").config();

if (typeof fetch !== "function") {
  throw new Error("Este script requiere Node 18+ (fetch global)");
}

const ExcelJS = require("exceljs");

const CENTRAL_EMAIL = process.env.TEST_CENTRAL_EMAIL || "";
const CENTRAL_PASSWORD = process.env.TEST_CENTRAL_PASSWORD || "";
let BASE_URL = process.env.API_BASE_URL || null;

if (!CENTRAL_EMAIL || !CENTRAL_PASSWORD) {
  throw new Error(
    "Faltan TEST_CENTRAL_EMAIL y/o TEST_CENTRAL_PASSWORD en el entorno para ejecutar la suite critica"
  );
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRefreshCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    const setCookies = headers.getSetCookie();
    for (const cookie of setCookies) {
      const match = cookie.match(/refresh_token=([^;]+)/i);
      if (match) return `refresh_token=${match[1]}`;
    }
  }

  const raw = headers.get("set-cookie") || "";
  const match = raw.match(/refresh_token=([^;]+)/i);
  if (!match) return null;
  return `refresh_token=${match[1]}`;
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
    refreshCookie: pickRefreshCookie(out.res.headers),
  };
}

async function authRequest(path, token, opts = {}) {
  const headers = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return request(path, { ...opts, headers });
}

function buildMovementEvidenceForm(fields, filename, text = "evidencia automatizada") {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, String(value));
  });
  form.append(
    "file",
    new Blob([text], { type: "application/pdf" }),
    filename
  );
  return form;
}

async function getDependenciesByEstablishment(establishmentId, token) {
  const res = await authRequest(
    `/catalog/dependencies?establishmentId=${establishmentId}&take=100`,
    token
  );
  assert(res.res.ok, `Dependencies fallo para est ${establishmentId}: ${res.res.status}`);
  return res.body?.items || [];
}

async function waitForAssetImportCompletion(batchId, token, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 90000);
  const pollMs = Number(opts.pollMs || 1200);
  const startedAt = Date.now();
  let lastBody = null;

  while (Date.now() - startedAt < timeoutMs) {
    const statusRes = await authRequest(`/assets/imports/${batchId}`, token);
    if (statusRes.res.ok && statusRes.body) {
      lastBody = statusRes.body;
      const status = String(statusRes.body.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "FAILED") {
        return statusRes.body;
      }
    }
    await sleep(pollMs);
  }

  throw new Error(
    `Timeout esperando import assets batch ${batchId}. Ultimo estado: ${JSON.stringify(lastBody)}`
  );
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
  console.log(`[setup] API local para tests: ${BASE_URL}`);

  return {
    close: async () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function run() {
  const now = new Date();
  const closableFiscalYear = now.getFullYear() - 1;
  const closableAssetDate = new Date(Date.UTC(closableFiscalYear, 5, 15, 12, 0, 0)).toISOString();
  const blockedFiscalYear = now.getFullYear();

  console.log("[0] Health");
  const health = await request("/health");
  assert(health.res.ok, `Health fallo: ${health.res.status}`);
  const ready = await request("/ready");
  assert(ready.res.ok, `Ready fallo: ${ready.res.status} ${JSON.stringify(ready.body)}`);
  const metrics = await request("/metrics");
  assert(metrics.res.ok, `Metrics fallo: ${metrics.res.status} ${JSON.stringify(metrics.body)}`);
  assert(
    typeof metrics.body?.service?.uptimeSec === "number",
    "Metrics no devolvio service.uptimeSec"
  );
  assert(metrics.body?.db?.ok === true, "Metrics no reporta DB disponible");
  const metricsProm = await request("/metrics/prometheus");
  assert(
    metricsProm.res.ok,
    `Metrics Prometheus fallo: ${metricsProm.res.status} ${String(metricsProm.body).slice(0, 200)}`
  );
  assert(
    String(metricsProm.body || "").includes("inventario_uptime_seconds"),
    "Metrics Prometheus no incluye inventario_uptime_seconds"
  );
  assert(
    String(metricsProm.body || "").includes("inventario_db_up"),
    "Metrics Prometheus no incluye inventario_db_up"
  );

  console.log("[1] Login ADMIN_CENTRAL");
  const centralLogin = await login(CENTRAL_EMAIL, CENTRAL_PASSWORD);
  assert(
    centralLogin.res.ok && centralLogin.token,
    `Login central fallo: ${centralLogin.res.status} ${JSON.stringify(centralLogin.body)}`
  );
  assert(centralLogin.refreshCookie, "Login no devolvio cookie refresh_token");
  const centralToken = centralLogin.token;

  console.log("[2] Auth refresh ok");
  const refreshed = await request("/auth/refresh", {
    method: "POST",
    headers: { Cookie: centralLogin.refreshCookie },
  });
  assert(
    refreshed.res.ok && refreshed.body?.token,
    `Refresh fallo: ${refreshed.res.status} ${JSON.stringify(refreshed.body)}`
  );
  const rotatedRefreshCookie = pickRefreshCookie(refreshed.res.headers);
  assert(rotatedRefreshCookie, "Refresh no devolvio cookie rotada");

  console.log("[3] Auth logout ok y refresh revocado");
  const logout = await request("/auth/logout", {
    method: "POST",
    headers: { Cookie: rotatedRefreshCookie },
  });
  assert(logout.res.ok, `Logout fallo: ${logout.res.status} ${JSON.stringify(logout.body)}`);

  const refreshAfterLogout = await request("/auth/refresh", {
    method: "POST",
    headers: { Cookie: rotatedRefreshCookie },
  });
  assert(
    refreshAfterLogout.res.status === 401,
    `Refresh post-logout debio ser 401, obtuvo ${refreshAfterLogout.res.status}`
  );

  console.log("[4] Catalogos base (states/types/establishments/dependencies)");
  const statesRes = await authRequest("/catalog/asset-states?take=100", centralToken);
  assert(statesRes.res.ok, `asset-states fallo: ${statesRes.res.status}`);
  const states = statesRes.body?.items || [];
  const bueno = states.find((s) => s.name === "BUENO");
  const baja = states.find((s) => s.name === "BAJA");
  assert(bueno?.id, "No existe estado BUENO");
  assert(baja?.id, "No existe estado BAJA");
  const typesRes = await authRequest("/catalog/asset-types?take=100", centralToken);
  assert(typesRes.res.ok, `asset-types fallo: ${typesRes.res.status}`);
  const types = typesRes.body?.items || [];
  const controlType = types.find((t) => t.name === "CONTROL") || types[0];
  assert(controlType?.id, "No existe AssetType para pruebas");

  const estRes = await authRequest("/catalog/establishments?take=100", centralToken);
  assert(estRes.res.ok, `Establishments fallo: ${estRes.res.status}`);
  const establishments = estRes.body?.items || [];
  assert(establishments.length > 0, "No hay establecimientos activos para test");

  let sourceEstablishment = null;
  let sourceDependencies = [];
  for (const est of establishments) {
    const deps = await getDependenciesByEstablishment(est.id, centralToken);
    if (deps.length > 0) {
      sourceEstablishment = est;
      sourceDependencies = deps;
      break;
    }
  }
  assert(sourceEstablishment, "No existe establecimiento con dependencies activas");

  const sourceDependencyId = sourceDependencies[0].id;
  let targetEstablishment = establishments.find(
    (e) => e.id !== sourceEstablishment.id && e.institutionId === sourceEstablishment.institutionId
  );
  let targetDependencyId = null;

  if (targetEstablishment) {
    const targetDeps = await getDependenciesByEstablishment(targetEstablishment.id, centralToken);
    if (targetDeps.length > 0) {
      targetDependencyId = targetDeps[0].id;
    } else {
      targetEstablishment = null;
    }
  }

  if (!targetEstablishment) {
    targetEstablishment = sourceEstablishment;
    const newDepName = `Test Transfer Dep ${Date.now()}`;
    const createDep = await authRequest("/admin/dependencies", centralToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDepName,
        establishmentId: sourceEstablishment.id,
      }),
    });
    assert(
      createDep.res.status === 201,
      `No se pudo crear dependency destino fallback: ${createDep.res.status} ${JSON.stringify(
        createDep.body
      )}`
    );
    targetDependencyId = createDep.body?.id;
  }
  assert(targetDependencyId, "No hay dependency destino disponible para transfer");

  console.log("[4.1] Admin CRUD 409 codes (institution/establishment/dependency)");
  const guardSuffix = Date.now();
  const guardInstitutionRes = await authRequest("/admin/institutions", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Test Guard Institution ${guardSuffix}`,
    }),
  });
  let guardInstitutionId = null;
  let guardInstitutionOwned = false;
  if (guardInstitutionRes.res.status === 201 && guardInstitutionRes.body?.id) {
    guardInstitutionId = guardInstitutionRes.body.id;
    guardInstitutionOwned = true;
  } else if (
    guardInstitutionRes.res.status === 409 &&
    guardInstitutionRes.body?.code === "INSTITUTION_SINGLETON_LOCKED"
  ) {
    guardInstitutionId = sourceEstablishment.institutionId;
  } else {
    assert(
      false,
      `Create institution guard fallo: ${guardInstitutionRes.res.status} ${JSON.stringify(
        guardInstitutionRes.body
      )}`
    );
  }

  const guardEstablishmentRes = await authRequest("/admin/establishments", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Test Guard Establishment ${guardSuffix}`,
      type: "TEST",
      institutionId: guardInstitutionId,
    }),
  });
  assert(
    guardEstablishmentRes.res.status === 201 && guardEstablishmentRes.body?.id,
    `Create establishment guard fallo: ${guardEstablishmentRes.res.status} ${JSON.stringify(
      guardEstablishmentRes.body
    )}`
  );
  const guardEstablishmentId = guardEstablishmentRes.body.id;

  const guardDependencyRes = await authRequest("/admin/dependencies", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Test Guard Dependency ${guardSuffix}`,
      establishmentId: guardEstablishmentId,
    }),
  });
  assert(
    guardDependencyRes.res.status === 201 && guardDependencyRes.body?.id,
    `Create dependency guard fallo: ${guardDependencyRes.res.status} ${JSON.stringify(
      guardDependencyRes.body
    )}`
  );
  const guardDependencyId = guardDependencyRes.body.id;

  const guardCatalogRes = await authRequest("/admin/catalog-items", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Test Catalog Asset ${guardSuffix}`,
      category: "MUEBLE",
      subcategory: "OFICINA",
      brand: "MarcaTest",
      modelName: "ModeloTest",
      unit: "unidad",
    }),
  });
  assert(
    guardCatalogRes.res.status === 201 && guardCatalogRes.body?.id,
    `Create catalog item guard fallo: ${guardCatalogRes.res.status} ${JSON.stringify(
      guardCatalogRes.body
    )}`
  );
  const guardCatalogId = guardCatalogRes.body.id;

  const depreciationSuggestionRes = await authRequest("/assets/depreciation/suggest", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      catalogItemId: guardCatalogId,
      assetTypeId: controlType.id,
      accountingAccount: "ACC-GUARD",
      acquisitionValue: 1000,
      acquisitionDate: new Date().toISOString(),
    }),
  });
  assert(
    depreciationSuggestionRes.res.ok,
    `Sugerencia depreciacion fallo: ${depreciationSuggestionRes.res.status} ${JSON.stringify(
      depreciationSuggestionRes.body
    )}`
  );
  assert(
    Number.isInteger(Number(depreciationSuggestionRes.body?.usefulLifeYears)) &&
      Number(depreciationSuggestionRes.body.usefulLifeYears) > 0,
    "La sugerencia de depreciacion no devolvio vida util valida"
  );

  const guardAssetRes = await authRequest("/assets", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      establishmentId: sourceEstablishment.id,
      dependencyId: sourceDependencyId,
      assetStateId: bueno.id,
      assetTypeId: controlType.id,
      catalogItemId: guardCatalogId,
      name: `Test Guard Asset ${guardSuffix}`,
      accountingAccount: "ACC-GUARD",
      analyticCode: "AN-GUARD",
      acquisitionValue: 1000,
      acquisitionDate: new Date().toISOString(),
    }),
  });
  assert(
    guardAssetRes.res.status === 201 && guardAssetRes.body?.id,
    `Create asset guard fallo: ${guardAssetRes.res.status} ${JSON.stringify(guardAssetRes.body)}`
  );
  assert(
    Number.isInteger(Number(guardAssetRes.body?.usefulLifeYears)) &&
      Number(guardAssetRes.body.usefulLifeYears) > 0,
    "Create asset guard no devolvio usefulLifeYears auto-sugerida"
  );
  assert(
    String(guardAssetRes.body?.depreciationStartDate || "").slice(0, 10) ===
      String(guardAssetRes.body?.acquisitionDate || "").slice(0, 10),
    "Create asset guard no guardo depreciationStartDate por defecto"
  );

  const depActiveReactivateRes = await authRequest(
    `/admin/dependencies/${guardDependencyId}/reactivate`,
    centralToken,
    { method: "PUT" }
  );
  assert(
    depActiveReactivateRes.res.status === 409,
    `Dependency reactivate activo debio ser 409, obtuvo ${depActiveReactivateRes.res.status}`
  );
  assert(
    depActiveReactivateRes.body?.code === "DEPENDENCY_ALREADY_ACTIVE",
    `Dependency reactivate activo code inesperado: ${depActiveReactivateRes.body?.code}`
  );

  const estActiveReactivateRes = await authRequest(
    `/admin/establishments/${guardEstablishmentId}/reactivate`,
    centralToken,
    { method: "PUT" }
  );
  assert(
    estActiveReactivateRes.res.status === 409,
    `Establishment reactivate activo debio ser 409, obtuvo ${estActiveReactivateRes.res.status}`
  );
  assert(
    estActiveReactivateRes.body?.code === "ESTABLISHMENT_ALREADY_ACTIVE",
    `Establishment reactivate activo code inesperado: ${estActiveReactivateRes.body?.code}`
  );

  if (guardInstitutionOwned) {
    const instActiveReactivateRes = await authRequest(
      `/admin/institutions/${guardInstitutionId}/reactivate`,
      centralToken,
      { method: "PUT" }
    );
    assert(
      instActiveReactivateRes.res.status === 409,
      `Institution reactivate activo debio ser 409, obtuvo ${instActiveReactivateRes.res.status}`
    );
    assert(
      instActiveReactivateRes.body?.code === "INSTITUTION_ALREADY_ACTIVE",
      `Institution reactivate activo code inesperado: ${instActiveReactivateRes.body?.code}`
    );
  } else {
    assert(
      guardInstitutionRes.body?.code === "INSTITUTION_SINGLETON_LOCKED",
      `Institution singleton lock code inesperado: ${guardInstitutionRes.body?.code}`
    );
  }

  const deleteDependencyGuardRes = await authRequest(
    `/admin/dependencies/${sourceDependencyId}`,
    centralToken,
    { method: "DELETE" }
  );
  assert(
    deleteDependencyGuardRes.res.status === 409,
    `Delete dependency con activos debio ser 409, obtuvo ${deleteDependencyGuardRes.res.status}`
  );
  assert(
    deleteDependencyGuardRes.body?.code === "DEPENDENCY_HAS_ACTIVE_ASSETS",
    `Delete dependency code inesperado: ${deleteDependencyGuardRes.body?.code}`
  );
  assert(
    Number(deleteDependencyGuardRes.body?.details?.activeAssets || 0) > 0,
    "Delete dependency no devolvio details.activeAssets > 0"
  );

  const deleteEstablishmentGuardRes = await authRequest(
    `/admin/establishments/${guardEstablishmentId}`,
    centralToken,
    { method: "DELETE" }
  );
  if (deleteEstablishmentGuardRes.res.status === 409) {
    assert(
      deleteEstablishmentGuardRes.body?.code === "ESTABLISHMENT_HAS_ACTIVE_DEPENDENCIES",
      `Delete establishment code inesperado: ${deleteEstablishmentGuardRes.body?.code}`
    );
    assert(
      Number(deleteEstablishmentGuardRes.body?.details?.activeDependencies || 0) > 0,
      "Delete establishment no devolvio details.activeDependencies > 0"
    );
  } else {
    assert(
      deleteEstablishmentGuardRes.res.status === 200,
      `Delete establishment debio ser 200 o 409, obtuvo ${deleteEstablishmentGuardRes.res.status}`
    );
    assert(
      Number(deleteEstablishmentGuardRes.body?.autoDeactivatedDependencies || 0) > 0,
      "Delete establishment 200 no devolvio autoDeactivatedDependencies > 0"
    );
  }

  if (guardInstitutionOwned) {
    const deleteInstitutionGuardRes = await authRequest(
      `/admin/institutions/${guardInstitutionId}`,
      centralToken,
      { method: "DELETE" }
    );
    if (deleteInstitutionGuardRes.res.status === 409) {
      assert(
        deleteInstitutionGuardRes.body?.code === "INSTITUTION_HAS_ACTIVE_ESTABLISHMENTS",
        `Delete institution code inesperado: ${deleteInstitutionGuardRes.body?.code}`
      );
      assert(
        Number(deleteInstitutionGuardRes.body?.details?.activeEstablishments || 0) > 0,
        "Delete institution no devolvio details.activeEstablishments > 0"
      );
    } else {
      assert(
        deleteInstitutionGuardRes.res.status === 200,
        `Delete institution debio ser 200 o 409, obtuvo ${deleteInstitutionGuardRes.res.status}`
      );
      assert(
        deleteInstitutionGuardRes.body?.isActive === false,
        "Delete institution 200 no devolvio institucion inactiva"
      );
    }
  }

  console.log("[5] Usuarios create/update/list/deactivate/includeInactive");
  const suffix = Date.now();
  const managedEmail = `test.user.${suffix}@inventacore.cl`;
  const managedPassword = "TestPass123!";

  const createUserRes = await authRequest("/admin/users", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: managedEmail,
      password: managedPassword,
      roleType: "ADMIN_ESTABLISHMENT",
      establishmentId: sourceEstablishment.id,
    }),
  });
  assert(
    createUserRes.res.status === 201,
    `Create user fallo: ${createUserRes.res.status} ${JSON.stringify(createUserRes.body)}`
  );
  const managedUserId = createUserRes.body?.id;
  assert(managedUserId, "Create user no devolvio id");

  const updateUserRes = await authRequest(`/admin/users/${managedUserId}`, centralToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test User Updated" }),
  });
  assert(
    updateUserRes.res.ok,
    `Update user fallo: ${updateUserRes.res.status} ${JSON.stringify(updateUserRes.body)}`
  );
  assert(
    updateUserRes.body?.name === "Test User Updated",
    "Update user no aplico nombre esperado"
  );

  const listActiveRes = await authRequest(
    `/admin/users?q=${encodeURIComponent(managedEmail)}&take=10&skip=0`,
    centralToken
  );
  assert(listActiveRes.res.ok, `List users fallo: ${listActiveRes.res.status}`);
  assert(
    Array.isArray(listActiveRes.body?.items) &&
      listActiveRes.body.items.some((u) => u.id === managedUserId && u.isActive === true),
    "List users no contiene usuario activo recien creado"
  );

  const managedLogin = await login(managedEmail, managedPassword);
  assert(
    managedLogin.res.ok && managedLogin.refreshCookie,
    `Login usuario gestionado fallo: ${managedLogin.res.status} ${JSON.stringify(managedLogin.body)}`
  );

  const deactivateUserRes = await authRequest(`/admin/users/${managedUserId}`, centralToken, {
    method: "DELETE",
  });
  assert(
    deactivateUserRes.res.ok,
    `Deactivate user fallo: ${deactivateUserRes.res.status} ${JSON.stringify(
      deactivateUserRes.body
    )}`
  );
  assert(deactivateUserRes.body?.isActive === false, "Usuario no quedo inactivo");

  const deactivateAgainRes = await authRequest(`/admin/users/${managedUserId}`, centralToken, {
    method: "DELETE",
  });
  assert(
    deactivateAgainRes.res.status === 409,
    `Second deactivate debio ser 409, obtuvo ${deactivateAgainRes.res.status}`
  );
  assert(
    deactivateAgainRes.body?.code === "USER_ALREADY_INACTIVE",
    `Second deactivate code inesperado: ${deactivateAgainRes.body?.code}`
  );

  const listInactiveRes = await authRequest(
    `/admin/users?q=${encodeURIComponent(managedEmail)}&includeInactive=true&take=10&skip=0`,
    centralToken
  );
  assert(listInactiveRes.res.ok, `List includeInactive fallo: ${listInactiveRes.res.status}`);
  assert(
    listInactiveRes.body?.items?.some((u) => u.id === managedUserId && u.isActive === false),
    "includeInactive no devolvio usuario inactivo"
  );

  const managedLoginAfterDeactivate = await login(managedEmail, managedPassword);
  assert(
    managedLoginAfterDeactivate.res.status === 401,
    `Login de usuario inactivo debio fallar 401, obtuvo ${managedLoginAfterDeactivate.res.status}`
  );

  const managedRefreshAfterDeactivate = await request("/auth/refresh", {
    method: "POST",
    headers: { Cookie: managedLogin.refreshCookie },
  });
  assert(
    managedRefreshAfterDeactivate.res.status === 401,
    `Refresh de usuario inactivo debio fallar 401, obtuvo ${managedRefreshAfterDeactivate.res.status}`
  );

  console.log("[6] Audit USER");
  const userAuditRes = await authRequest(
    `/admin/audit?entityType=USER&take=20&skip=0`,
    centralToken
  );
  assert(userAuditRes.res.ok, `Admin audit USER fallo: ${userAuditRes.res.status}`);
  assert(
    Array.isArray(userAuditRes.body?.items) &&
      userAuditRes.body.items.some((a) => a.entityType === "USER" && a.entityId === managedUserId),
    "Audit USER no contiene eventos del usuario gestionado"
  );

  console.log("[7] Assets create/transfer/status/restore");
  const createAssetRes = await authRequest("/assets", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      establishmentId: sourceEstablishment.id,
      dependencyId: sourceDependencyId,
      assetStateId: bueno.id,
      assetTypeId: controlType.id,
      catalogItemId: guardCatalogId,
      name: `Test Asset ${suffix}`,
      accountingAccount: "ACC-TEST",
      analyticCode: "AN-TEST",
      acquisitionValue: 150000,
      acquisitionDate: closableAssetDate,
    }),
  });
  assert(
    createAssetRes.res.status === 201,
    `Create asset fallo: ${createAssetRes.res.status} ${JSON.stringify(createAssetRes.body)}`
  );
  const assetId = createAssetRes.body?.id;
  assert(assetId, "Create asset no devolvio id");
  assert(
    Number.isInteger(Number(createAssetRes.body?.usefulLifeYears)) &&
      Number(createAssetRes.body.usefulLifeYears) > 0,
    "Create asset no devolvio usefulLifeYears auto-sugerida"
  );

  const transferNoEvidenceRes = await authRequest(`/assets/${assetId}/transfer`, centralToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toEstablishmentId: targetEstablishment.id,
      toDependencyId: targetDependencyId,
      reasonCode: "OPERATIONAL_NEED",
    }),
  });
  assert(
    transferNoEvidenceRes.res.status === 400,
    `Transfer sin evidencia debio ser 400, obtuvo ${transferNoEvidenceRes.res.status}`
  );
  assert(
    transferNoEvidenceRes.body?.code === "EVIDENCE_REQUIRED",
    `Transfer sin evidencia code inesperado: ${transferNoEvidenceRes.body?.code}`
  );

  const transferRes = await authRequest(`/assets/${assetId}/transfer`, centralToken, {
    method: "PUT",
    body: buildMovementEvidenceForm(
      {
        toEstablishmentId: targetEstablishment.id,
        toDependencyId: targetDependencyId,
        reasonCode: "OPERATIONAL_NEED",
        docType: "ACTA",
        note: "Transferencia por prueba critica",
      },
      `transfer_${suffix}.pdf`
    ),
  });
  assert(
    transferRes.res.ok,
    `Transfer asset fallo: ${transferRes.res.status} ${JSON.stringify(transferRes.body)}`
  );
  assert(
    transferRes.body?.establishmentId === targetEstablishment.id &&
      transferRes.body?.dependencyId === targetDependencyId,
    "Transfer asset no dejo destino esperado"
  );
  assert(transferRes.body?.movementId, "Transfer no devolvio movementId");

  const duplicateTransferRes = await authRequest(`/assets/${assetId}/transfer`, centralToken, {
    method: "PUT",
    body: buildMovementEvidenceForm(
      {
        toEstablishmentId: targetEstablishment.id,
        toDependencyId: targetDependencyId,
        reasonCode: "REASSIGNMENT",
        docType: "ACTA",
      },
      `transfer_dup_${suffix}.pdf`
    ),
  });
  assert(
    duplicateTransferRes.res.status === 409,
    `Transfer duplicada debio ser 409, obtuvo ${duplicateTransferRes.res.status}`
  );
  assert(
    duplicateTransferRes.body?.code === "ASSET_TRANSFER_SAME_DESTINATION",
    `Transfer duplicada code inesperado: ${duplicateTransferRes.body?.code}`
  );

  const invalidReasonCodeRes = await authRequest(`/assets/${assetId}/status`, centralToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetStateId: baja.id,
      reasonCode: "NOT_ALLOWED_REASON",
    }),
  });
  assert(
    invalidReasonCodeRes.res.status === 400,
    `Status con reasonCode invalido debio ser 400, obtuvo ${invalidReasonCodeRes.res.status}`
  );
  assert(
    invalidReasonCodeRes.body?.code === "INVALID_REASON_CODE",
    `Status con reasonCode invalido code inesperado: ${invalidReasonCodeRes.body?.code}`
  );

  const missingReasonCodeRes = await authRequest(`/assets/${assetId}/status`, centralToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetStateId: baja.id,
    }),
  });
  assert(
    missingReasonCodeRes.res.status === 400,
    `Status sin reasonCode debio ser 400, obtuvo ${missingReasonCodeRes.res.status}`
  );
  assert(
    missingReasonCodeRes.body?.code === "MISSING_REASON_CODE",
    `Status sin reasonCode code inesperado: ${missingReasonCodeRes.body?.code}`
  );

  const uploadEvidence = async (movementId, docType, filename) => {
    const form = new FormData();
    form.append("movementId", String(movementId));
    form.append("docType", docType);
    form.append("note", "Evidencia automatizada");
    form.append(
      "file",
      new Blob([`evidencia ${docType}`], { type: "application/pdf" }),
      filename
    );
    const out = await authRequest(`/assets/${assetId}/evidence`, centralToken, {
      method: "POST",
      body: form,
    });
    assert(
      out.res.status === 201 && out.body?.id,
      `Upload evidencia fallo: ${out.res.status} ${JSON.stringify(out.body)}`
    );
    return out.body;
  };

  await uploadEvidence(transferRes.body.movementId, "ACTA", `acta_transfer_${suffix}.pdf`);

  const bajaRes = await authRequest(`/assets/${assetId}/status`, centralToken, {
    method: "PUT",
    body: buildMovementEvidenceForm(
      {
        assetStateId: baja.id,
        reasonCode: "DAMAGED",
        docType: "FOTO",
      },
      `baja_${suffix}.pdf`
    ),
  });
  assert(bajaRes.res.ok, `Status BAJA fallo: ${bajaRes.res.status} ${JSON.stringify(bajaRes.body)}`);
  assert(bajaRes.body?.isDeleted === true, "Asset no quedo dado de baja");
  assert(bajaRes.body?.movementId, "Status no devolvio movementId");
  await uploadEvidence(bajaRes.body.movementId, "FOTO", `foto_baja_${suffix}.pdf`);

  const restoreRes = await authRequest(`/assets/${assetId}/restore`, centralToken, {
    method: "PUT",
    body: buildMovementEvidenceForm(
      {
        assetStateId: bueno.id,
        reasonCode: "REPAIR_COMPLETED",
        docType: "FACTURA",
      },
      `restore_${suffix}.pdf`
    ),
  });
  assert(
    restoreRes.res.ok,
    `Restore asset fallo: ${restoreRes.res.status} ${JSON.stringify(restoreRes.body)}`
  );
  assert(restoreRes.body?.isDeleted === false, "Asset no se restauro correctamente");
  assert(restoreRes.body?.movementId, "Restore no devolvio movementId");
  await uploadEvidence(restoreRes.body.movementId, "FACTURA", `factura_restore_${suffix}.pdf`);

  const transferActaRes = await authRequest(
    `/assets/${assetId}/movements/${transferRes.body.movementId}/acta`,
    centralToken
  );
  assert(transferActaRes.res.ok, `Acta transfer fallo: ${transferActaRes.res.status}`);
  assert(
    String(transferActaRes.contentType || "").includes("text/html"),
    `Acta transfer content-type inesperado: ${transferActaRes.contentType}`
  );
  assert(
    String(transferActaRes.body || "").includes("Acta de entrega"),
    "Acta transfer no contiene el titulo esperado"
  );

  const restoreActaRes = await authRequest(
    `/assets/${assetId}/movements/${restoreRes.body.movementId}/acta`,
    centralToken
  );
  assert(restoreActaRes.res.ok, `Acta restore fallo: ${restoreActaRes.res.status}`);
  assert(
    String(restoreActaRes.body || "").includes("Acta de devolucion"),
    "Acta restore no contiene el titulo esperado"
  );

  const historyRes = await authRequest(`/assets/${assetId}/history`, centralToken);
  assert(historyRes.res.ok, `History asset fallo: ${historyRes.res.status}`);
  const historyItems = historyRes.body?.movements || historyRes.body?.items || [];
  const transferMovement = historyItems.find((m) => m.id === transferRes.body.movementId);
  const bajaMovement = historyItems.find((m) => m.id === bajaRes.body.movementId);
  const restoreMovement = historyItems.find((m) => m.id === restoreRes.body.movementId);
  assert(
    transferMovement?.reasonCode === "OPERATIONAL_NEED",
    `Transfer movement reasonCode inesperado: ${transferMovement?.reasonCode}`
  );
  assert(
    bajaMovement?.reasonCode === "DAMAGED",
    `Status BAJA movement reasonCode inesperado: ${bajaMovement?.reasonCode}`
  );
  assert(
    restoreMovement?.reasonCode === "REPAIR_COMPLETED",
    `Restore movement reasonCode inesperado: ${restoreMovement?.reasonCode}`
  );

  const evidenceListRes = await authRequest(
    `/assets/${assetId}/evidence?take=20&skip=0`,
    centralToken
  );
  assert(evidenceListRes.res.ok, `List evidence fallo: ${evidenceListRes.res.status}`);
  assert(
    Number(evidenceListRes.body?.total || 0) >= 3,
    "No se registraron evidencias esperadas"
  );

  console.log("[7.1] Cierre anual de depreciacion");
  const fiscalYear = closableFiscalYear;
  const closeDepRes = await authRequest("/assets/depreciation/runs/close", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fiscalYear }),
  });
  if (closeDepRes.res.status === 201) {
    assert(
      closeDepRes.body?.fiscalYear === fiscalYear,
      `Cierre depreciacion devolvio fiscalYear inesperado: ${closeDepRes.body?.fiscalYear}`
    );
    assert(
      Number(closeDepRes.body?.totalAssets || 0) > 0,
      "Cierre depreciacion no incluyo activos"
    );
  } else {
    assert(
      closeDepRes.res.status === 409,
      `Cierre depreciacion debio ser 201 o 409, obtuvo ${closeDepRes.res.status}`
    );
    const runsRes = await authRequest("/assets/depreciation/runs?take=5", centralToken);
    assert(runsRes.res.ok, `Listado de cierres fallo: ${runsRes.res.status}`);
    assert(
      Number(runsRes.body?.items?.[0]?.fiscalYear || 0) === fiscalYear,
      "El ultimo cierre no coincide con el ano fiscal esperado"
    );
  }

  const blockedCloseDepRes = await authRequest("/assets/depreciation/runs/close", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fiscalYear: blockedFiscalYear }),
  });
  assert(
    blockedCloseDepRes.res.status === 409,
    `Cierre depreciacion del ano actual debio ser 409, obtuvo ${blockedCloseDepRes.res.status}`
  );
  assert(
    blockedCloseDepRes.body?.code === "DEPRECIATION_RUN_NOT_AVAILABLE_YET",
    `Cierre depreciacion del ano actual code inesperado: ${blockedCloseDepRes.body?.code}`
  );

  console.log("[8] Import catalogo (excel)");
  const catalogWb = new ExcelJS.Workbook();
  const catalogSheet = catalogWb.addWorksheet("CATALOGO_IMPORT");
  catalogSheet.addRow([
    "name",
    "category",
    "subcategory",
    "brand",
    "modelName",
    "description",
    "unit",
  ]);
  catalogSheet.addRow([
    `Test Catalog Item ${suffix}`,
    "TEST",
    "Pruebas",
    "MarcaTest",
    "ModeloTest",
    "Creado por suite critica",
    "unidad",
  ]);
  const catalogBuffer = await catalogWb.xlsx.writeBuffer();

  const catalogForm = new FormData();
  catalogForm.append(
    "file",
    new Blob([catalogBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `catalog_import_${suffix}.xlsx`
  );

  const importCatalogRes = await authRequest("/admin/catalog-items/import/excel", centralToken, {
    method: "POST",
    body: catalogForm,
  });
  assert(
    importCatalogRes.res.status === 201,
    `Import catalogo fallo: ${importCatalogRes.res.status} ${JSON.stringify(importCatalogRes.body)}`
  );
  assert(
    Number(importCatalogRes.body?.createdCount || 0) >= 1,
    "Import catalogo no creo items"
  );

  console.log("[8.1] Import catalogo dedupe (officialKey/composite/mixed)");
  const preseedWb = new ExcelJS.Workbook();
  const preseedSheet = preseedWb.addWorksheet("CATALOGO_IMPORT");
  preseedSheet.addRow([
    "officialKey",
    "name",
    "category",
    "subcategory",
    "brand",
    "modelName",
    "description",
    "unit",
  ]);
  preseedSheet.addRow([
    `EXIST-${suffix}`,
    `Test Existing ${suffix}`,
    "TEST",
    "Seed",
    "MarcaSeed",
    "ModeloSeed",
    `Codigo: EXIST-${suffix} | Item para probar already-exists por llave oficial`,
    "unidad",
  ]);
  const preseedBuffer = await preseedWb.xlsx.writeBuffer();

  const preseedForm = new FormData();
  preseedForm.append(
    "file",
    new Blob([preseedBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `catalog_preseed_${suffix}.xlsx`
  );
  const preseedRes = await authRequest("/admin/catalog-items/import/excel", centralToken, {
    method: "POST",
    body: preseedForm,
  });
  assert(
    preseedRes.res.status === 201 && Number(preseedRes.body?.createdCount || 0) >= 1,
    `Preseed catalogo fallo: ${preseedRes.res.status} ${JSON.stringify(preseedRes.body)}`
  );

  const dedupeWb = new ExcelJS.Workbook();
  const dedupeSheet = dedupeWb.addWorksheet("CATALOGO_IMPORT");
  dedupeSheet.addRow([
    "officialKey",
    "name",
    "category",
    "subcategory",
    "brand",
    "modelName",
    "description",
    "unit",
  ]);
  dedupeSheet.addRow([
    `OFF-${suffix}`,
    `Test Official A ${suffix}`,
    "TEST",
    "Dedupe",
    "MarcaO",
    "ModeloO",
    "Creado por dedupe test",
    "unidad",
  ]);
  dedupeSheet.addRow([
    `OFF-${suffix}`,
    `Test Official B ${suffix}`,
    "TEST",
    "Dedupe",
    "MarcaOX",
    "ModeloOX",
    "Duplicado en input por officialKey",
    "unidad",
  ]);
  dedupeSheet.addRow([
    "",
    `Test Composite ${suffix}`,
    "TEST",
    "Comp",
    "MarcaC",
    "ModeloC",
    "Creado por dedupe test",
    "unidad",
  ]);
  dedupeSheet.addRow([
    "",
    `Test Composite ${suffix}`,
    "TEST",
    "Comp",
    "MarcaC",
    "ModeloC",
    "Duplicado en input por clave compuesta",
    "unidad",
  ]);
  dedupeSheet.addRow([
    `EXIST-${suffix}`,
    `Test Existing Changed ${suffix}`,
    "TEST",
    "Seed",
    "MarcaSeed",
    "ModeloSeedX",
    "Debe omitirse por already-exists officialKey",
    "unidad",
  ]);
  dedupeSheet.addRow([
    "",
    `Test Missing Category ${suffix}`,
    "",
    "Comp",
    "MarcaX",
    "ModeloX",
    "Debe ir a errores por faltante de category",
    "unidad",
  ]);
  dedupeSheet.addRow([
    `NEW-${suffix}`,
    `Test New ${suffix}`,
    "TEST",
    "Dedupe",
    "MarcaN",
    "ModeloN",
    "Creado por dedupe test",
    "unidad",
  ]);
  const dedupeBuffer = await dedupeWb.xlsx.writeBuffer();

  const dedupeForm = new FormData();
  dedupeForm.append(
    "file",
    new Blob([dedupeBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `catalog_dedupe_${suffix}.xlsx`
  );

  const dedupeRes = await authRequest("/admin/catalog-items/import/excel", centralToken, {
    method: "POST",
    body: dedupeForm,
  });
  assert(
    dedupeRes.res.status === 201,
    `Import dedupe catalogo fallo: ${dedupeRes.res.status} ${JSON.stringify(dedupeRes.body)}`
  );
  assert(
    Number(dedupeRes.body?.createdCount || 0) >= 2,
    `Import dedupe debio crear >=2, obtuvo ${dedupeRes.body?.createdCount}`
  );
  assert(
    Number(dedupeRes.body?.skippedCount || 0) >= 3,
    `Import dedupe debio omitir >=3, obtuvo ${dedupeRes.body?.skippedCount}`
  );
  assert(
    Number(dedupeRes.body?.errorCount || 0) >= 1,
    `Import dedupe debio tener >=1 error, obtuvo ${dedupeRes.body?.errorCount}`
  );

  const skipped = dedupeRes.body?.skipped || [];
  assert(
    skipped.some((s) => s.reason === "DUPLICATE_IN_INPUT" && s.dedupeBy === "OFFICIAL_KEY"),
    "Import dedupe: falta DUPLICATE_IN_INPUT por OFFICIAL_KEY"
  );
  assert(
    skipped.some((s) => s.reason === "DUPLICATE_IN_INPUT" && s.dedupeBy === "COMPOSITE"),
    "Import dedupe: falta DUPLICATE_IN_INPUT por COMPOSITE"
  );
  assert(
    skipped.some((s) => s.reason === "ALREADY_EXISTS" && s.dedupeBy === "OFFICIAL_KEY"),
    "Import dedupe: falta ALREADY_EXISTS por OFFICIAL_KEY"
  );

  assert(
    dedupeRes.body?.dedupePolicy?.primary && dedupeRes.body?.dedupePolicy?.fallback,
    "Import dedupe no devolvio dedupePolicy"
  );

  console.log("[8.2] Catalog update duplicate officialKey returns 409");
  const leftCreateRes = await authRequest("/admin/catalog-items", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      officialKey: `UPD-A-${suffix}`,
      name: `Test Update A ${suffix}`,
      category: "TEST",
      subcategory: "Update",
      brand: "MarcaU",
      modelName: "ModeloU-A",
      unit: "unidad",
    }),
  });
  assert(
    leftCreateRes.res.status === 201 && leftCreateRes.body?.id,
    `Create catalog A fallo: ${leftCreateRes.res.status} ${JSON.stringify(leftCreateRes.body)}`
  );

  const rightCreateRes = await authRequest("/admin/catalog-items", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      officialKey: `UPD-B-${suffix}`,
      name: `Test Update B ${suffix}`,
      category: "TEST",
      subcategory: "Update",
      brand: "MarcaU",
      modelName: "ModeloU-B",
      unit: "unidad",
    }),
  });
  assert(
    rightCreateRes.res.status === 201 && rightCreateRes.body?.id,
    `Create catalog B fallo: ${rightCreateRes.res.status} ${JSON.stringify(rightCreateRes.body)}`
  );

  const duplicateUpdateRes = await authRequest(
    `/admin/catalog-items/${rightCreateRes.body.id}`,
    centralToken,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        officialKey: `UPD-A-${suffix}`,
      }),
    }
  );
  assert(
    duplicateUpdateRes.res.status === 409,
    `Update catalog duplicate officialKey debio ser 409: ${duplicateUpdateRes.res.status} ${JSON.stringify(duplicateUpdateRes.body)}`
  );
  assert(
    duplicateUpdateRes.body?.code === "CATALOG_ITEM_DUPLICATE_OFFICIAL_KEY",
    `Update catalog duplicate officialKey code inesperado: ${duplicateUpdateRes.body?.code}`
  );

  console.log("[8.3] Catalog create duplicate officialKey returns 409");
  const duplicateCreateRes = await authRequest("/admin/catalog-items", centralToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      officialKey: `UPD-A-${suffix}`,
      name: `Test Duplicate Create ${suffix}`,
      category: "TEST",
      subcategory: "Update",
      brand: "MarcaU",
      modelName: "ModeloU-C",
      unit: "unidad",
    }),
  });
  assert(
    duplicateCreateRes.res.status === 409,
    `Create catalog duplicate officialKey debio ser 409: ${duplicateCreateRes.res.status} ${JSON.stringify(duplicateCreateRes.body)}`
  );
  assert(
    duplicateCreateRes.body?.code === "CATALOG_ITEM_DUPLICATE_OFFICIAL_KEY",
    `Create catalog duplicate officialKey code inesperado: ${duplicateCreateRes.body?.code}`
  );

  console.log("[9] Import assets (excel)");
  const assetsWb = new ExcelJS.Workbook();
  const assetsSheet = assetsWb.addWorksheet("Assets");
  assetsSheet.addRow([
    "establishmentId",
    "dependencyId",
    "assetStateId",
    "assetTypeId",
    "Codigo Interno",
    "Nombre",
    "Marca",
    "Modelo",
    "Serie",
    "Cuenta Contable",
    "Analitico",
    "Tipo",
    "Estado",
    "Establecimiento",
    "Dependencia",
    "Valor Adquisicion",
    "Fecha Adquisicion",
  ]);
  assetsSheet.addRow([
    targetEstablishment.id,
    targetDependencyId,
    bueno.id,
    controlType.id,
    "",
    `Test Asset Import ${suffix}`,
    "MarcaI",
    "ModeloI",
    `SER-${suffix}`,
    "ACC-IMP",
    "AN-IMP",
    "CONTROL",
    "BUENO",
    targetEstablishment.name || "",
    "",
    50000,
    new Date(),
  ]);
  const assetsBuffer = await assetsWb.xlsx.writeBuffer();

  const assetsForm = new FormData();
  assetsForm.append(
    "file",
    new Blob([assetsBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `assets_import_${suffix}.xlsx`
  );

  const importAssetsRes = await authRequest("/assets/import/excel", centralToken, {
    method: "POST",
    body: assetsForm,
  });
  assert(
    importAssetsRes.res.ok,
    `Import assets fallo: ${importAssetsRes.res.status} ${JSON.stringify(importAssetsRes.body)}`
  );
  const importBatchId = Number(importAssetsRes.body?.id || importAssetsRes.body?.batchId || 0);
  assert(importBatchId > 0, `Import assets no devolvio batchId valido: ${JSON.stringify(importAssetsRes.body)}`);
  const importAssetsFinal = await waitForAssetImportCompletion(importBatchId, centralToken);
  assert(
    String(importAssetsFinal?.status || "").toUpperCase() === "COMPLETED",
    `Import assets no completo: ${JSON.stringify(importAssetsFinal)}`
  );
  assert(
    Number(importAssetsFinal?.createdCount || 0) >= 1,
    `Import assets no creo registros: ${JSON.stringify(importAssetsFinal)}`
  );

  console.log("OK: suite critica completada");
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
  console.error("Suite critica fallo:", err.message);
  process.exit(1);
});
