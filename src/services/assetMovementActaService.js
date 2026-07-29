const { prisma } = require("../prisma");
const { enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { notFound } = require("../utils/httpError");
const { MOVEMENT_REASON_CODES, MOVEMENT_REASON_LABELS } = require("../constants/movementReasonCodes");
const {
  getOfficialBrandLogoDataUrl,
  getOfficialBrandName,
} = require("../utils/officialBranding");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Sin dato";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Sin dato";
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function formatDateTime(value) {
  if (!value) return "Sin dato";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Sin dato";
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function row(label, value) {
  const safeValue =
    value === null || value === undefined || value === ""
      ? "Sin dato"
      : escapeHtml(value);
  return `<tr><th>${escapeHtml(label)}</th><td>${safeValue}</td></tr>`;
}

function hasReasonCode(group, reasonCode) {
  return Array.isArray(group) && group.includes(reasonCode);
}

function getActaTitle(movement) {
  const reasonCode = String(movement?.reasonCode || "").trim();
  if (movement?.type === "TRANSFER") return "Acta de entrega";
  if (movement?.type === "RELOCATION") return "Acta de reasignacion interna";
  if (movement?.type === "STATUS_CHANGE") {
    if (hasReasonCode(MOVEMENT_REASON_CODES.RESTORE, reasonCode)) {
      return "Acta de devolucion";
    }
    if (hasReasonCode(MOVEMENT_REASON_CODES.STATUS_CHANGE, reasonCode)) {
      return "Acta de baja";
    }
  }
  return "Acta de movimiento";
}

function getMovementKindLabel(movement) {
  if (!movement) return "Movimiento";
  if (movement.type === "TRANSFER") return "Transferencia";
  if (movement.type === "RELOCATION") return "Reasignacion interna";
  if (movement.type === "STATUS_CHANGE") {
    if (hasReasonCode(MOVEMENT_REASON_CODES.RESTORE, movement.reasonCode)) {
      return "Devolucion";
    }
    return "Cambio de estado";
  }
  return movement.type || "Movimiento";
}

function getReasonLabel(reasonCode) {
  return MOVEMENT_REASON_LABELS[reasonCode] || reasonCode || "Sin motivo";
}

function resolveSnapshotValue(snapshot, asset, key) {
  if (snapshot && snapshot[key] !== undefined && snapshot[key] !== null && snapshot[key] !== "") {
    return snapshot[key];
  }
  return asset[key];
}

async function resolveMovementAudit(asset, movement) {
  const action =
    movement.type === "TRANSFER" || movement.type === "RELOCATION"
      ? "RELOCATE"
      : hasReasonCode(MOVEMENT_REASON_CODES.RESTORE, movement.reasonCode)
        ? "RESTORE"
        : "STATUS_CHANGE";

  const candidates = await prisma.assetAudit.findMany({
    where: {
      assetId: asset.id,
      userId: movement.userId,
      action,
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const movementTs = new Date(movement.createdAt).getTime();
  const timeWindowMs = 15 * 1000;

  for (const candidate of candidates) {
    const candidateTs = new Date(candidate.createdAt).getTime();
    if (candidateTs < movementTs || candidateTs > movementTs + timeWindowMs) {
      continue;
    }

    const after = candidate.after || {};
    if (movement.type === "TRANSFER" || movement.type === "RELOCATION") {
      if (Number(after.dependencyId) === Number(movement.toDependencyId)) {
        return candidate;
      }
    } else if (movement.type === "STATUS_CHANGE") {
      if (hasReasonCode(MOVEMENT_REASON_CODES.RESTORE, movement.reasonCode)) {
        if (after.isDeleted === false) {
          return candidate;
        }
      } else if (hasReasonCode(MOVEMENT_REASON_CODES.STATUS_CHANGE, movement.reasonCode)) {
        if (after.isDeleted === true) {
          return candidate;
        }
      }
    }
  }

  return null;
}

async function buildAssetMovementActaHtml(assetId, movementId, user) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      internalCode: true,
      name: true,
      brand: true,
      modelName: true,
      serialNumber: true,
      quantity: true,
      accountingAccount: true,
      analyticCode: true,
      acquisitionValue: true,
      acquisitionDate: true,
      depreciationStartDate: true,
      usefulLifeYears: true,
      responsibleName: true,
      responsibleRut: true,
      responsibleRole: true,
      costCenter: true,
      assetStateId: true,
      establishmentId: true,
      dependencyId: true,
      isDeleted: true,
      createdAt: true,
      assetType: { select: { id: true, name: true } },
      assetState: { select: { id: true, name: true } },
      establishment: {
        select: {
          id: true,
          name: true,
          institution: { select: { id: true, name: true } },
        },
      },
      dependency: { select: { id: true, name: true } },
    },
  });

  if (!asset) {
    throw notFound("Activo fijo no encontrado");
  }

  enforceEstablishmentScope(user, asset.establishmentId);

  const movement = await prisma.movement.findUnique({
    where: { id: movementId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      fromDependency: { select: { id: true, name: true } },
      toDependency: { select: { id: true, name: true } },
    },
  });

  if (!movement || movement.assetId !== asset.id) {
    throw notFound("Movimiento no encontrado");
  }

  const audit = await resolveMovementAudit(asset, movement);
  const snapshot = audit?.after || null;

  const assetStateId = resolveSnapshotValue(snapshot, asset, "assetStateId");
  const establishmentId = resolveSnapshotValue(snapshot, asset, "establishmentId");
  const dependencyId = resolveSnapshotValue(snapshot, asset, "dependencyId");

  const [assetState, establishment, dependency] = await Promise.all([
    assetStateId
      ? prisma.assetState.findUnique({ where: { id: Number(assetStateId) } })
      : Promise.resolve(asset.assetState),
    establishmentId
      ? prisma.establishment.findUnique({
          where: { id: Number(establishmentId) },
          include: { institution: true },
        })
      : Promise.resolve(asset.establishment),
    dependencyId
      ? prisma.dependency.findUnique({ where: { id: Number(dependencyId) } })
      : Promise.resolve(asset.dependency),
  ]);

  const title = getActaTitle(movement);
  const movementLabel = getMovementKindLabel(movement);
  const reasonLabel = getReasonLabel(movement.reasonCode);
  const generatedAt = new Date();

  const safeInternalCode = resolveSnapshotValue(snapshot, asset, "internalCode");
  const safeName = resolveSnapshotValue(snapshot, asset, "name");
  const safeBrand = resolveSnapshotValue(snapshot, asset, "brand");
  const safeModel = resolveSnapshotValue(snapshot, asset, "modelName");
  const safeSerial = resolveSnapshotValue(snapshot, asset, "serialNumber");
  const safeQuantity = resolveSnapshotValue(snapshot, asset, "quantity");
  const safeAccountingAccount = resolveSnapshotValue(snapshot, asset, "accountingAccount");
  const safeAnalyticCode = resolveSnapshotValue(snapshot, asset, "analyticCode");
  const safeAcquisitionValue = resolveSnapshotValue(snapshot, asset, "acquisitionValue");
  const safeAcquisitionDate = resolveSnapshotValue(snapshot, asset, "acquisitionDate");
  const safeDepreciationStartDate = resolveSnapshotValue(
    snapshot,
    asset,
    "depreciationStartDate"
  );
  const safeUsefulLifeYears = resolveSnapshotValue(snapshot, asset, "usefulLifeYears");
  const safeResponsibleName = resolveSnapshotValue(snapshot, asset, "responsibleName");
  const safeResponsibleRut = resolveSnapshotValue(snapshot, asset, "responsibleRut");
  const safeResponsibleRole = resolveSnapshotValue(snapshot, asset, "responsibleRole");
  const safeCostCenter = resolveSnapshotValue(snapshot, asset, "costCenter");

  const logoDataUrl = getOfficialBrandLogoDataUrl();
  const brandName = getOfficialBrandName();
  const faviconHtml = `<link rel="icon" type="image/png" href="/assets/public/favicon.ico" />
  <link rel="shortcut icon" type="image/png" href="/assets/public/favicon.ico" />`;

  const rows = [
    row("Codigo inventario", `INV-${safeInternalCode}`),
    row("Nombre del bien", safeName),
    row("Marca", safeBrand),
    row("Modelo", safeModel),
    row("Numero de serie", safeSerial),
    row("Cantidad", safeQuantity),
    row("Cuenta contable", safeAccountingAccount),
    row("Codigo analitico", safeAnalyticCode),
    row("Valor de adquisicion", safeAcquisitionValue),
    row("Fecha de adquisicion", formatDate(safeAcquisitionDate)),
    row("Inicio de depreciacion", formatDate(safeDepreciationStartDate || safeAcquisitionDate)),
    row("Vida util (anios)", safeUsefulLifeYears ? String(safeUsefulLifeYears) : null),
    row("Estado del bien", assetState?.name || asset.assetState?.name),
    row("Institucion", establishment?.institution?.name || asset.establishment?.institution?.name),
    row("Establecimiento", establishment?.name || asset.establishment?.name),
    row("Sector", dependency?.name || asset.dependency?.name),
    row("Responsable registrado", safeResponsibleName),
    row("RUT responsable", safeResponsibleRut),
    row("Cargo responsable", safeResponsibleRole),
    row("Centro de costo", safeCostCenter),
  ].join("");

  const movementRows = [
    row("Acta", `Nro. ${movement.id}`),
    row("Tipo de documento", title),
    row("Tipo de movimiento", movementLabel),
    row("Motivo", reasonLabel),
    row("Fecha del movimiento", formatDateTime(movement.createdAt)),
    row("Generado por", movement.user?.name || movement.user?.email),
    row("Origen", movement.fromDependency?.name || dependency?.name || asset.dependency?.name),
    row("Destino", movement.toDependency?.name || dependency?.name || asset.dependency?.name),
  ].join("");

  const signatureBoxes = [
    {
      label: "Firma funcionario que entrega",
      text: safeResponsibleName || "____________________________",
    },
    {
      label: "Firma funcionario que recibe",
      text: "____________________________",
    },
    {
      label: "Firma responsable de sector",
      text:
        movement.toDependency?.name || dependency?.name || asset.dependency?.name
          ? `${movement.toDependency?.name || dependency?.name || asset.dependency?.name}`
          : "____________________________",
    },
    {
      label: "Firma quien genera el acta",
      text: movement.user?.name || movement.user?.email || "____________________________",
    },
  ];

  const signatureHtml = signatureBoxes
    .map(
      (box) => `
        <section class="signature-box">
          <strong>${escapeHtml(box.label)}</strong>
          <span>${escapeHtml(box.text)}</span>
        </section>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(`${title} INV-${safeInternalCode}`)}</title>
  ${faviconHtml}
  <style>
    :root {
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #102033;
      --muted: #5d6b7b;
      --line: #d8e2ec;
      --accent: #0f4c81;
      --accent-2: #1d6fb2;
    }
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 18px;
    }
    .wrap {
      max-width: 980px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 8px 28px rgba(9, 30, 66, 0.08);
      overflow: hidden;
      break-inside: avoid;
    }
    .head {
      padding: 18px 20px;
      color: #fff;
      background: linear-gradient(120deg, var(--accent), var(--accent-2));
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .brand img {
      height: 34px;
      width: auto;
      background: rgba(255, 255, 255, 0.92);
      border-radius: 8px;
      padding: 4px 6px;
    }
    .brand span {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      opacity: 0.9;
    }
    .head h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
    }
    .head p {
      margin: 8px 0 0;
      font-size: 13px;
      opacity: 0.95;
    }
    .body {
      padding: 18px;
    }
    .intro {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      background: #f8fbff;
    }
    .pill strong {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .pill span {
      font-size: 14px;
      color: var(--text);
      line-height: 1.35;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid var(--line);
      margin-bottom: 16px;
    }
    th, td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
      text-align: left;
      vertical-align: top;
    }
    th {
      width: 34%;
      color: var(--accent);
      background: #f8fbff;
      font-weight: 700;
    }
    .section-title {
      margin: 0 0 10px;
      font-size: 17px;
      color: var(--accent);
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 10px;
    }
    .signature-box {
      min-height: 88px;
      border: 1px dashed var(--line);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 8px;
      background: #fcfdff;
    }
    .signature-box strong {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .signature-box span {
      min-height: 24px;
      border-top: 1px solid #a8b7c7;
      padding-top: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }
    .footer-note {
      margin-top: 14px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
    }
    .print-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      font-size: 12px;
      margin-top: 12px;
      width: fit-content;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .wrap { max-width: none; gap: 12px; }
      .card { box-shadow: none; }
      .head { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-badge { display: none; }
    }
    @media (max-width: 760px) {
      .meta,
      .signatures {
        grid-template-columns: 1fr;
      }
      th {
        width: 42%;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <article class="card">
      <header class="head">
      ${
          logoDataUrl
            ? `<div class="brand">
          <img src="${logoDataUrl}" alt="Logo institucional" />
          <span>${escapeHtml(brandName)}</span>
        </div>`
            : ""
        }
        <h1>${escapeHtml(title)}</h1>
        <p>Documento interno para entrega, devolucion o reasignacion del activo fijo.</p>
        <div class="print-badge">INV-${escapeHtml(safeInternalCode)} | Acta ${escapeHtml(
          movement.id
        )}</div>
      </header>
      <div class="body">
        <p class="intro">
          Este documento se genera automaticamente para ser impreso, firmado y luego archivado
          en el sistema como evidencia de tipo ACTA. Si el movimiento ya fue firmado, adjunte la
          version escaneada desde la misma ficha del activo.
        </p>
        <h2 class="section-title">Resumen del movimiento</h2>
        <table aria-label="Resumen del movimiento">
          <tbody>
            ${movementRows}
          </tbody>
        </table>
        <h2 class="section-title">Identificacion del bien</h2>
        <table aria-label="Identificacion del bien">
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="meta">
          <div class="pill">
            <strong>Institucion / Establecimiento</strong>
            <span>${escapeHtml(
              `${establishment?.institution?.name || asset.establishment?.institution?.name || "Sin dato"} / ${establishment?.name || asset.establishment?.name || "Sin dato"}`
            )}</span>
          </div>
          <div class="pill">
            <strong>Sector actual</strong>
            <span>${escapeHtml(dependency?.name || asset.dependency?.name || "Sin dato")}</span>
          </div>
        </div>
        <h2 class="section-title">Firmas</h2>
        <div class="signatures">
          ${signatureHtml}
        </div>
        <p class="footer-note">
          Fecha de generacion: ${escapeHtml(formatDateTime(generatedAt))}. El acta firmada y
          escaneada debe quedar almacenada como evidencia ACTA en el mismo modulo del activo.
        </p>
      </div>
    </article>
  </main>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
        setTimeout(() => window.close(), 300);
      }, 100);
    });
  </script>
</body>
</html>`;
}

module.exports = { buildAssetMovementActaHtml };
