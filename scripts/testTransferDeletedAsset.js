// scripts/testTransferDeletedAsset.js
// Verifica que un asset dado de baja NO se pueda transferir.
// Requiere API corriendo y DB con seed.

if (typeof fetch !== "function") {
  throw new Error("Este script requiere Node 18+ (fetch global)");
}

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_CENTRAL_EMAIL || "";
const PASSWORD = process.env.TEST_CENTRAL_PASSWORD || "";
const SOURCE_ESTABLISHMENT_ID = Number(process.env.TEST_SOURCE_ESTABLISHMENT_ID || 1);
const TARGET_ESTABLISHMENT_ID = Number(process.env.TEST_TARGET_ESTABLISHMENT_ID || 3);

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("[1] Login ADMIN_CENTRAL");
  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert(login.res.ok, `Login fallo: ${login.res.status} ${JSON.stringify(login.body)}`);
  const token = login.body?.token;
  assert(token, "Login no devolvio token");
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  console.log("[2] Obtener estados y ubicar BAJA");
  const statesRes = await request("/catalog/asset-states?take=100", { headers: authHeaders });
  assert(statesRes.res.ok, `asset-states fallo: ${statesRes.res.status}`);
  const states = statesRes.body?.items || [];
  const baja = states.find((s) => s.name === "BAJA");
  const activeState = states.find((s) => s.name !== "BAJA");
  assert(baja?.id, "No existe estado BAJA (seed?)");
  assert(activeState?.id, "No existe estado activo para crear asset");

  console.log("[3] Obtener dependency origen y destino");
  const sourceDeps = await request(
    `/catalog/dependencies?establishmentId=${SOURCE_ESTABLISHMENT_ID}&take=100`,
    { headers: authHeaders }
  );
  assert(sourceDeps.res.ok, `dependencies origen fallo: ${sourceDeps.res.status}`);
  const sourceDependencyId = sourceDeps.body?.items?.[0]?.id;
  assert(sourceDependencyId, "No hay dependency origen disponible");

  const targetDeps = await request(
    `/catalog/dependencies?establishmentId=${TARGET_ESTABLISHMENT_ID}&take=100`,
    { headers: authHeaders }
  );
  assert(targetDeps.res.ok, `dependencies destino fallo: ${targetDeps.res.status}`);
  const targetDependencyId = targetDeps.body?.items?.[0]?.id;
  assert(targetDependencyId, "No hay dependency destino disponible");

  console.log("[4] Crear asset de prueba");
  const createPayload = {
    establishmentId: SOURCE_ESTABLISHMENT_ID,
    dependencyId: sourceDependencyId,
    assetStateId: activeState.id,
    name: `Asset Baja Transfer Test ${Date.now()}`,
    accountingAccount: "ACC-TEST",
    analyticCode: "AN-TEST",
    acquisitionValue: 100000,
    acquisitionDate: new Date().toISOString(),
  };
  const created = await request("/assets", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(createPayload),
  });
  assert(
    created.res.status === 201,
    `Crear asset fallo: ${created.res.status} ${JSON.stringify(created.body)}`
  );
  const assetId = created.body?.id;
  assert(assetId, "Crear asset no devolvio id");

  console.log("[5] Dar de baja asset");
  const low = await request(`/assets/${assetId}/status`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      assetStateId: baja.id,
      reason: "Baja de validacion automatizada",
    }),
  });
  assert(
    low.res.ok,
    `Cambiar estado a BAJA fallo: ${low.res.status} ${JSON.stringify(low.body)}`
  );

  console.log("[6] Intentar transferir asset en BAJA (debe fallar 409)");
  const transfer = await request(`/assets/${assetId}/transfer`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      toEstablishmentId: TARGET_ESTABLISHMENT_ID,
      toDependencyId: targetDependencyId,
      reason: "Transferencia de validacion automatizada",
    }),
  });
  assert(
    transfer.res.status === 409,
    `Se esperaba 409, obtuvo ${transfer.res.status}: ${JSON.stringify(transfer.body)}`
  );
  const errorMsg = transfer.body?.error || "";
  assert(
    typeof errorMsg === "string" && errorMsg.toLowerCase().includes("baja"),
    `Mensaje inesperado al transferir asset en baja: ${JSON.stringify(transfer.body)}`
  );

  console.log("OK: asset en BAJA no se puede transferir");
}

main().catch((e) => {
  console.error("Test fallo:", e.message);
  process.exit(1);
});
