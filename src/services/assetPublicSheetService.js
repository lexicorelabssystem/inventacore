const { prisma } = require("../prisma");
const { notFound } = require("../utils/httpError");
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

function row(label, value) {
  const safeValue = value ? escapeHtml(value) : "Sin dato";
  return `<tr><th>${escapeHtml(label)}</th><td>${safeValue}</td></tr>`;
}

async function buildPublicAssetTechnicalSheetHtml(assetId) {
  const asset = await prisma.asset.findUnique({
    where: { id: Number(assetId) },
    include: {
      assetType: true,
      assetState: true,
      establishment: {
        include: { institution: true },
      },
      dependency: true,
      catalogItem: true,
    },
  });

  if (!asset) {
    throw notFound("Activo fijo no encontrado");
  }

  const latestImageEvidence = await prisma.assetEvidence.findFirst({
    where: {
      assetId: asset.id,
      mimeType: {
        startsWith: "image/",
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      fileName: true,
      mimeType: true,
      content: true,
      createdAt: true,
    },
  });

  const imageDataUrl = latestImageEvidence
    ? `data:${latestImageEvidence.mimeType};base64,${Buffer.from(
        latestImageEvidence.content
      ).toString("base64")}`
    : "";

  const title = `Ficha Tecnica Activo INV-${asset.internalCode}`;
  const brand = asset.brand || asset.catalogItem?.brand || null;
  const modelName = asset.modelName || asset.catalogItem?.modelName || null;
  const description = asset.catalogItem?.description || null;
  const quantity =
    Number.isFinite(Number(asset.quantity)) && Number(asset.quantity) > 0
      ? String(asset.quantity)
      : "1";
  const logoDataUrl = getOfficialBrandLogoDataUrl();
  const brandName = getOfficialBrandName();
  const faviconHtml = `<link rel="icon" type="image/png" href="/assets/public/favicon.ico" />
  <link rel="shortcut icon" type="image/png" href="/assets/public/favicon.ico" />`;

  const rows = [
    row("Codigo inventario", `INV-${asset.internalCode}`),
    row("Nombre", asset.name || asset.catalogItem?.name),
    row("Categoria", asset.catalogItem?.category),
    row("Subcategoria", asset.catalogItem?.subcategory),
    row("Descripcion", description),
    row("Marca", brand),
    row("Modelo", modelName),
    row("Numero de serie", asset.serialNumber),
    row("Cantidad", quantity),
    row("Estado", asset.assetState?.name),
    row("Tipo", asset.assetType?.name),
    row("Institucion", asset.establishment?.institution?.name),
    row("Establecimiento", asset.establishment?.name),
    row("Sector", asset.dependency?.name),
    row("Responsable", asset.responsibleName),
    row("Rut responsable", asset.responsibleRut),
    row("Cargo responsable", asset.responsibleRole),
    row("Fecha adquisicion", formatDate(asset.acquisitionDate)),
    row("Fecha inicio depreciacion", formatDate(asset.depreciationStartDate || asset.acquisitionDate)),
    row("Vida util (anios)", asset.usefulLifeYears ? String(asset.usefulLifeYears) : null),
    row("Fecha registro", formatDate(asset.createdAt)),
  ].join("");

  const evidenceHtml = imageDataUrl
    ? `<section class="evidence">
        <h2>Imagen de evidencia</h2>
        <img src="${imageDataUrl}" alt="Evidencia del activo ${escapeHtml(
        `INV-${asset.internalCode}`
      )}" />
        <p class="meta">Archivo: ${escapeHtml(latestImageEvidence.fileName)} | Fecha: ${escapeHtml(
        formatDate(latestImageEvidence.createdAt)
      )}</p>
      </section>`
    : `<section class="evidence">
        <h2>Imagen de evidencia</h2>
        <p>No hay imagen de evidencia registrada.</p>
      </section>`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${faviconHtml}
  <style>
    :root {
      --bg: #f3f6fa;
      --card: #ffffff;
      --text: #1b2430;
      --muted: #5f6f83;
      --line: #d9e2ec;
      --accent: #0d4f8b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
    }
    .wrap {
      max-width: 960px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(9, 30, 66, 0.08);
      overflow: hidden;
    }
    .head {
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(110deg, #0d4f8b, #1d6fb2);
      color: #fff;
    }
    .head h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      font-weight: 700;
    }
    .head-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .head-brand img {
      height: 34px;
      width: auto;
      object-fit: contain;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.92);
      padding: 3px 4px;
    }
    .head-brand span {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.92;
      font-weight: 700;
    }
    .head p {
      margin: 6px 0 0;
      font-size: 13px;
      opacity: 0.95;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
      text-align: left;
      vertical-align: top;
    }
    th {
      width: 36%;
      background: #f8fbff;
      color: var(--accent);
      font-weight: 600;
    }
    .evidence {
      padding: 16px;
    }
    .evidence h2 {
      margin: 0 0 10px;
      color: var(--accent);
      font-size: 17px;
    }
    .evidence p {
      margin: 0;
      color: var(--muted);
    }
    .evidence .meta {
      margin-top: 10px;
      font-size: 12px;
    }
    .evidence img {
      width: 100%;
      max-height: 520px;
      object-fit: contain;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <article class="card">
      <header class="head">
      ${
          logoDataUrl
            ? `<div class="head-brand">
        <img src="${logoDataUrl}" alt="Logo institucional" />
        <span>${escapeHtml(brandName)}</span>
      </div>`
            : ""
        }
        <h1>Ficha Tecnica del Activo</h1>
        <p>Codigo: ${escapeHtml(`INV-${asset.internalCode}`)}</p>
      </header>
      <table aria-label="Ficha tecnica del activo">
        <tbody>
          ${rows}
        </tbody>
      </table>
    </article>
    <article class="card">
      ${evidenceHtml}
    </article>
  </main>
</body>
</html>`;
}

module.exports = { buildPublicAssetTechnicalSheetHtml };
