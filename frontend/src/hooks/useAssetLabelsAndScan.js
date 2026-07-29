import { useEffect } from 'react'
import { UI_TEXT } from '../constants/uiText'
import logoServicioNinez from '../assets/images/logodelgob.png'
import logoInventacore from '../assets/images/logo-inventacore.png'

const LABEL = {
  widthMm: 40,
  heightMm: 30,
  marginMm: 1,
  offsetX: 0,
  offsetY: 0,
  qrSizeMm: 25.8,
  barcodeWidthMm: 12,
  barcodeHeightMm: 2.2,
}

const LABEL_QR_LEFT_MM = 0.2
const LABEL_QR_TOP_MM = 1.1
const LABEL_TEXT_RIGHT_MM = 0.6
const LABEL_TEXT_GAP_FROM_QR_MM = 0.6
const LABEL_CODE_TOP_MM = 1.8
const LABEL_BODY_TOP_MM = 7.2
const QR_PRINT_WIDTH_PX = 2200
const LABEL_PRINT_MODE = {
  QR: 'qr',
  BARCODE: 'barcode',
}
const DEFAULT_PLANCHETA_LABEL_TITLE = 'Servicio de Proteccion Especializada a la Ninez y Adolescencia'
const LABEL_BRANDING_BY_KEY = {
  gob: {
    key: 'gob',
    title: DEFAULT_PLANCHETA_LABEL_TITLE,
    logoUrl: logoServicioNinez,
  },
  inventacore: {
    key: 'inventacore',
    title: 'Inventacore',
    logoUrl: logoInventacore,
  },
  none: {
    key: 'none',
    title: DEFAULT_PLANCHETA_LABEL_TITLE,
    logoUrl: '',
  },
}
const BARCODE_INSTITUTION_LINES = [
  'SERVICIO NACIONAL DE PROTECCION',
  'ESPECIALIZADA A LA NINEZ Y',
  'ADOLESCENCIA',
]

function getErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage
}

function isActivePrintableAsset(item) {
  const stateName = String(item?.assetState?.name || '').trim().toUpperCase()
  return Boolean(item?.internalCode) && !item?.isDeleted && stateName !== 'BAJA'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function truncateLabelText(value, maxLength = 26) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function splitLabelText(value, maxCharsPerLine = 12, maxLines = 2) {
  const normalized = truncateLabelText(value, maxCharsPerLine * maxLines + 4)
  if (!normalized) return []
  const words = normalized.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length >= maxLines - 1) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length
  const remainingWords = words.slice(consumedWords)
  if (remainingWords.length && lines.length) {
    const lastIndex = Math.min(lines.length - 1, maxLines - 1)
    lines[lastIndex] = truncateLabelText(
      `${lines[lastIndex]} ${remainingWords.join(' ')}`.trim(),
      maxCharsPerLine
    )
  }
  return lines.slice(0, maxLines)
}

function formatLabelCode(internalCode) {
  const numeric = Number(internalCode)
  if (!Number.isInteger(numeric) || numeric <= 0) return ''
  return `VAL${String(numeric).padStart(7, '0')}`
}

function resolvePrintableLabelCode(asset) {
  return asset?.internalCode
}

function comparePrintableLabelCodeAsc(a, b) {
  const leftCode = Number(resolvePrintableLabelCode(a))
  const rightCode = Number(resolvePrintableLabelCode(b))
  const leftIsNumber = Number.isFinite(leftCode)
  const rightIsNumber = Number.isFinite(rightCode)

  if (leftIsNumber && rightIsNumber && leftCode !== rightCode) return leftCode - rightCode
  if (leftIsNumber && !rightIsNumber) return -1
  if (!leftIsNumber && rightIsNumber) return 1

  const fallback = String(resolvePrintableLabelCode(a) || '').localeCompare(
    String(resolvePrintableLabelCode(b) || ''),
    undefined,
    { numeric: true, sensitivity: 'base' }
  )
  if (fallback !== 0) return fallback

  const leftId = Number(a?.id)
  const rightId = Number(b?.id)
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) return leftId - rightId
  return 0
}

function formatLabelCodeForDisplay(code, modeInput = LABEL_PRINT_MODE.QR) {
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!normalizedCode) return ''
  if (normalizeLabelPrintMode(modeInput) !== LABEL_PRINT_MODE.BARCODE) return normalizedCode
  const parts = normalizedCode.match(/^([A-Z]+)(\d+)$/)
  if (!parts) return normalizedCode
  return `${parts[1]} ${parts[2]}`
}

function resolveLabelBranding(input) {
  const key =
    typeof input === 'string' ? input : typeof input?.brandKey === 'string' ? input.brandKey : 'gob'
  return LABEL_BRANDING_BY_KEY[key] || LABEL_BRANDING_BY_KEY.gob
}

function normalizeLabelPrintMode(mode) {
  return mode === LABEL_PRINT_MODE.BARCODE ? LABEL_PRINT_MODE.BARCODE : LABEL_PRINT_MODE.QR
}

function getBarcodeHeading(label) {
  const residenceName = label?.residenceName || label?.establishment || 'SIN RESIDENCIA'
  return `RESIDENCIA FAMILIAR: ${residenceName}`
}

function getBarcodeProductName(label) {
  if (label?.blankTemplate) return ''
  return truncateLabelText(label?.name || UI_TEXT.assetSingular, 48).toUpperCase()
}

function useAssetLabelsAndScan({
  api,
  setErr,
  setOk,
  apiBase,
  publicSheetBase,
  loadQrCodeLib,
  loadJsBarcodeLib,
  loadJsPdfLib,
  loadHtml2CanvasLib,
  toPositiveIntOrNull,
  createdAsset,
  createdAssetBatch,
  qrCodeUrl,
  setQrCodeUrl,
  assetsList,
  assetListFilters,
  selectedAssetIds,
  setSelectedAssetIds,
  planchetaPreview,
  scanInput,
  setScanResult,
  selectAssetForModal,
}) {
  function getSafeAssetId(assetLike) {
    return toPositiveIntOrNull(assetLike?.id)
  }

  function buildAssetTechnicalSheetUrl(assetLike) {
    const assetId = getSafeAssetId(assetLike)
    if (!assetId) return ''
    const forcedPublicBase = String(publicSheetBase || '').trim().replace(/\/+$/, '')
    if (/^https?:\/\//i.test(forcedPublicBase)) {
      return `${forcedPublicBase}/assets/public/${assetId}/ficha.html`
    }
    let base = String(apiBase || '/api').trim()
    const forcedHttpsIndex = base.toLowerCase().lastIndexOf('https://')
    const forcedHttpIndex = base.toLowerCase().lastIndexOf('http://')
    const forcedIndex = Math.max(forcedHttpsIndex, forcedHttpIndex)
    if (forcedIndex > 0) {
      base = base.slice(forcedIndex)
    }
    base = base.replace(/\/+$/, '')
    if (/^https?:\/\//i.test(base)) {
      return `${base}/assets/public/${assetId}/ficha.html`
    }
    const normalizedBase = base.startsWith('/') ? base : `/${base}`
    return `${window.location.origin}${normalizedBase}/assets/public/${assetId}/ficha.html`
  }

  function getLabelData(asset) {
    const code = formatLabelCode(resolvePrintableLabelCode(asset))
    const name = asset?.name || asset?.catalogItem?.name || UI_TEXT.assetSingular
    const responsibleName = asset?.responsibleName || ''
    const assetId = getSafeAssetId(asset)
    const technicalSheetUrl = buildAssetTechnicalSheetUrl(asset)
    return {
      code,
      name,
      responsibleName,
      assetId,
      technicalSheetUrl,
      establishment: asset?.establishment?.name || '',
      dependency: asset?.dependency?.name || '',
      assetState: asset?.assetState?.name || '',
      blankTemplate: asset?.blankTemplate === true,
      residenceName: asset?.residenceName || asset?.establishment?.name || '',
    }
  }

  function getLabelBodyLines(label) {
    const sectorLines = splitLabelText(`SECTOR: ${label?.dependency || 'SIN SECTOR'}`, 12, 2)
    const nameLines = splitLabelText(label?.name, 12, 1)
    const responsibleLines = splitLabelText(label?.responsibleName, 12, 1)
    return [...sectorLines, ...nameLines, ...responsibleLines].filter(Boolean).slice(0, 4)
  }

  function getLabelLayoutMetrics() {
    const baseX = LABEL.marginMm + LABEL.offsetX
    const baseY = LABEL.marginMm + LABEL.offsetY
    const contentWidth = LABEL.widthMm - 2 * LABEL.marginMm
    const qrX = baseX + LABEL_QR_LEFT_MM
    const qrY = baseY + LABEL_QR_TOP_MM
    const qrSize = LABEL.qrSizeMm
    const textLeftX = qrX + qrSize + LABEL_TEXT_GAP_FROM_QR_MM
    const textTopY = baseY + LABEL_BODY_TOP_MM
    const codeTopY = baseY + LABEL_CODE_TOP_MM
    const textWidth = Math.max(4, LABEL.widthMm - LABEL.marginMm - LABEL_TEXT_RIGHT_MM - textLeftX)
    return { baseX, baseY, contentWidth, qrX, qrY, qrSize, textLeftX, textTopY, codeTopY, textWidth }
  }

  function getLabelBodyHtml(label) {
    return getLabelBodyLines(label)
      .map((line) => `<div class="line">${escapeHtml(line)}</div>`)
      .join('')
  }

  function getSingleLabelSheetStyles() {
    const { textLeftX, textTopY, textWidth } = getLabelLayoutMetrics()
    return `
      * { box-sizing: border-box; }
      .label-pdf-root {
        margin: 0;
        padding: ${LABEL.marginMm}mm;
        width: ${LABEL.widthMm}mm;
        height: ${LABEL.heightMm}mm;
        font-family: Arial, "Helvetica Neue", sans-serif;
        color: #0f172a;
        background: #fff;
      }
      .sheet {
        width: ${LABEL.widthMm - 2 * LABEL.marginMm}mm;
        height: ${LABEL.heightMm - 2 * LABEL.marginMm}mm;
        transform: translate(${LABEL.offsetX}mm, ${LABEL.offsetY}mm);
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
        overflow: hidden;
        background: #fff;
      }
      .sheet.sheet-barcode {
        border: 0.4mm solid #0f172a;
        border-radius: 4.8mm;
        padding: 0.6mm 0.7mm;
      }
      .code-top {
        position: absolute;
        top: ${LABEL_CODE_TOP_MM}mm;
        left: ${textLeftX}mm;
        width: ${textWidth}mm;
        text-align: left;
        font-weight: 800;
        font-size: 8.6px;
        line-height: 1.1;
        color: #020617;
        letter-spacing: 0;
        white-space: normal;
        word-break: break-word;
      }
      .side-right {
        position: absolute;
        left: ${textLeftX}mm;
        top: ${textTopY}mm;
        width: ${textWidth}mm;
        display: grid;
        gap: 0.5mm;
        text-align: left;
      }
      .line {
        font-size: 7.6px;
        line-height: 1.12;
        font-weight: 700;
        white-space: normal;
        word-break: break-word;
        overflow: visible;
        color: #111827;
      }
      .branding {
        position: absolute;
        left: ${textLeftX}mm;
        bottom: 0.8mm;
        width: ${textWidth}mm;
        display: grid;
        gap: 0.3mm;
        text-align: left;
      }
      .brand-title {
        font-size: 5px;
        line-height: 1.1;
        font-weight: 700;
        color: #334155;
        white-space: normal;
        word-break: break-word;
      }
      .brand-logo {
        width: 13mm;
        height: 3.6mm;
        object-fit: contain;
        object-position: left center;
        display: block;
      }
      .media {
        width: 100%;
        position: absolute;
        left: ${LABEL_QR_LEFT_MM}mm;
        top: ${LABEL_QR_TOP_MM}mm;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0.4mm;
      }
      .qr {
        width: ${LABEL.qrSizeMm}mm;
        height: ${LABEL.qrSizeMm}mm;
        background: #fff;
        display: block;
      }
      .barcode {
        width: ${LABEL.barcodeWidthMm}mm;
        height: ${LABEL.barcodeHeightMm}mm;
        object-fit: contain;
      }
      .sheet.sheet-barcode .code-top {
        display: none;
      }
      .sheet.sheet-barcode .side-right {
        display: none;
      }
      .sheet.sheet-barcode .line {
        display: none;
      }
      .sheet.sheet-barcode .barcode-institution {
        position: absolute;
        left: 1.1mm;
        top: 1.4mm;
        width: calc(100% - 2.2mm);
        display: grid;
        gap: 0;
        text-align: center;
      }
      .sheet.sheet-barcode .barcode-institution-line {
        font-size: 1.55mm;
        line-height: 0.96;
        font-weight: 900;
        letter-spacing: 0.01mm;
        color: #020617;
        text-transform: uppercase;
      }
      .sheet.sheet-barcode .barcode-regional {
        position: absolute;
        left: 1mm;
        top: 6.85mm;
        width: calc(100% - 2mm);
        text-align: center;
        font-size: 1.5mm;
        line-height: 1;
        font-weight: 900;
        color: #020617;
        text-transform: uppercase;
      }
      .sheet.sheet-barcode .barcode-heading {
        position: absolute;
        left: 1mm;
        top: 8.35mm;
        width: calc(100% - 2mm);
        text-align: center;
        font-size: 1.5mm;
        line-height: 0.98;
        font-weight: 900;
        color: #020617;
        white-space: normal;
        word-break: break-word;
        max-height: 2.9mm;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sheet.sheet-barcode .barcode-sector {
        position: absolute;
        left: 1mm;
        top: 11.25mm;
        width: calc(100% - 2mm);
        text-align: center;
        font-size: 1.55mm;
        line-height: 0.98;
        font-weight: 900;
        color: #020617;
        text-transform: uppercase;
        white-space: normal;
        word-break: break-word;
        max-height: 3.45mm;
        overflow: hidden;
        text-overflow: clip;
      }
      .sheet.sheet-barcode .barcode-product {
        position: absolute;
        left: 1mm;
        top: 13.95mm;
        width: calc(100% - 2mm);
        text-align: center;
        font-size: 1.82mm;
        line-height: 1.03;
        font-weight: 500;
        color: #020617;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        height: 2.2mm;
      }
      .sheet.sheet-barcode .barcode-code {
        margin-top: 0.05mm;
        text-align: center;
        font-size: 2.25mm;
        line-height: 1;
        letter-spacing: 0.18mm;
        font-weight: 900;
        color: #020617;
      }
      .sheet.sheet-barcode .branding {
        display: none;
      }
      .sheet.sheet-barcode .brand-title {
        display: none;
      }
      .sheet.sheet-barcode .brand-logo {
        display: none;
      }
      .sheet.sheet-barcode .media {
        left: 0;
        top: 15.7mm;
        width: 100%;
        align-items: center;
      }
      .sheet.sheet-barcode .barcode {
        width: 37.2mm;
        height: 9.2mm;
        background: #ffffff;
        filter: none;
        image-rendering: crisp-edges;
      }
      .sheet.sheet-barcode .qr {
        display: none;
      }
    `
  }

  function getLabelBrandingHtml(branding) {
    if (!branding) return ''
    return `
      <div class="branding">
        <div class="brand-title">${escapeHtml(branding.title || DEFAULT_PLANCHETA_LABEL_TITLE)}</div>
        ${branding.logoUrl ? `<img class="brand-logo" src="${branding.logoUrl}" alt="Logo" />` : ''}
      </div>
    `
  }

  function getLabelSheetMarkup(label, qr, barcode = '', branding, modeInput = LABEL_PRINT_MODE.QR) {
    const mode = normalizeLabelPrintMode(modeInput)
    const barcodeHeading = escapeHtml(getBarcodeHeading(label))
    const barcodeSectorText = label?.blankTemplate
      ? `RESIDENCIA: ${label?.residenceName || 'SIN RESIDENCIA'}`
      : `SECTOR: ${label?.dependency || 'SIN SECTOR'}`
    const barcodeSector = escapeHtml(truncateLabelText(barcodeSectorText, 58).toUpperCase())
    const barcodeProduct = escapeHtml(getBarcodeProductName(label))
    const codeLabel = escapeHtml(formatLabelCodeForDisplay(label.code, mode))
    const barcodeInstitution = BARCODE_INSTITUTION_LINES.map(
      (line) => `<div class="barcode-institution-line">${escapeHtml(line)}</div>`
    ).join('')
    return `
      <div class="sheet sheet-${mode}">
        <div class="code-top">${codeLabel}</div>
        ${
          mode === LABEL_PRINT_MODE.BARCODE
            ? `<div class="barcode-institution">${barcodeInstitution}</div><div class="barcode-regional">DIRECCIÓN REGIONAL</div><div class="barcode-heading">${barcodeHeading}</div><div class="barcode-sector">${barcodeSector}</div><div class="barcode-product">${barcodeProduct}</div>`
            : `<div class="side-right">${getLabelBodyHtml(label)}</div>`
        }
        ${mode === LABEL_PRINT_MODE.BARCODE ? '' : getLabelBrandingHtml(branding)}
        <div class="media">
          ${qr ? `<img class="qr" src="${qr}" alt="QR" />` : ''}
          ${barcode ? `<img class="barcode" src="${barcode}" alt="Barcode" />` : ''}
          ${barcode ? `<div class="barcode-code">${codeLabel}</div>` : ''}
        </div>
      </div>
    `
  }

  async function buildBarcodeDataUrl(value) {
    const { default: JsBarcode } = await loadJsBarcodeLib()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, value, {
      format: 'CODE128',
      displayValue: false,
      width: 1.85,
      height: 118,
      margin: 8,
      lineColor: '#000000',
      background: '#ffffff',
    })
    svg.setAttribute('shape-rendering', 'crispEdges')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      new XMLSerializer().serializeToString(svg)
    )}`
  }

  async function buildQrLabelDataUrl(qrValue, qrCodeLib) {
    if (!qrValue) return ''
    return qrCodeLib.toDataURL(qrValue, {
      margin: 1,
      width: QR_PRINT_WIDTH_PX,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
  }

  async function buildLabelMediaForMode(label, qrCodeLib, modeInput, fallbackQr = '') {
    const mode = normalizeLabelPrintMode(modeInput)
    if (mode === LABEL_PRINT_MODE.BARCODE) {
      return {
        mode,
        qr: '',
        barcode: await buildBarcodeDataUrl(label.code),
      }
    }
    const qrValue = getRequiredTechnicalSheetQrValue(label)
    const qr = fallbackQr || (await buildQrLabelDataUrl(qrValue, qrCodeLib))
    return {
      mode,
      qr,
      barcode: '',
    }
  }

  async function renderLabelSheetImageDataUrl(
    label,
    qr,
    barcode = '',
    branding,
    modeInput = LABEL_PRINT_MODE.QR
  ) {
    const { default: html2canvas } = await loadHtml2CanvasLib()
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.left = '-10000px'
    host.style.top = '0'
    host.style.zIndex = '-1'
    host.style.pointerEvents = 'none'
    host.innerHTML = `
      <style>${getSingleLabelSheetStyles()}</style>
      <div class="label-pdf-root">
        ${getLabelSheetMarkup(label, qr, barcode, branding, modeInput)}
      </div>
    `
    document.body.appendChild(host)
    try {
      const root = host.querySelector('.label-pdf-root')
      const canvas = await html2canvas(root, {
        backgroundColor: '#ffffff',
        scale: Math.max(3, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
      })
      return canvas.toDataURL('image/png')
    } finally {
      host.remove()
    }
  }

  function getRequiredTechnicalSheetQrValue(label) {
    const value = String(label?.technicalSheetUrl || '').trim()
    if (!value) {
      throw new Error(`El activo ${label?.code || ''} no tiene URL de ficha tecnica para QR.`)
    }
    return value
  }

  function getPrintableLabelBatch(items) {
    return (items || [])
      .filter(isActivePrintableAsset)
      .sort(comparePrintableLabelCodeAsc)
  }

  async function downloadLabelPdf() {
    if (!createdAsset?.internalCode) return
    const [{ jsPDF }, { default: QRCode }] = await Promise.all([loadJsPdfLib(), loadQrCodeLib()])
    const label = getLabelData(createdAsset)
    const doc = new jsPDF({ unit: 'mm', format: [LABEL.widthMm, LABEL.heightMm] })
    const media = await buildLabelMediaForMode(label, QRCode, LABEL_PRINT_MODE.QR, qrCodeUrl)
    const imageDataUrl = await renderLabelSheetImageDataUrl(
      label,
      media.qr,
      media.barcode,
      resolveLabelBranding('gob'),
      media.mode
    )
    doc.addImage(imageDataUrl, 'PNG', 0, 0, LABEL.widthMm, LABEL.heightMm, undefined, 'FAST')
    doc.save(`label_${label.code}.pdf`)
  }

  async function openPrintLabel(modeInput = LABEL_PRINT_MODE.QR) {
    if (!createdAsset?.internalCode) return
    const mode = normalizeLabelPrintMode(modeInput)
    const label = getLabelData(createdAsset)
    const branding = resolveLabelBranding('gob')
    const qrModule = mode === LABEL_PRINT_MODE.QR ? await loadQrCodeLib() : null
    const QRCode = qrModule?.default || null
    const media = await buildLabelMediaForMode(label, QRCode, mode, qrCodeUrl)

    const win = window.open('', '_blank', 'width=480,height=420')
    if (!win) {
      setErr('El navegador bloqueo la ventana de impresion.')
      return
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(label.code)}</title>
  <style>
    @page { size: ${LABEL.widthMm}mm ${LABEL.heightMm}mm; margin: 0; }
    ${getSingleLabelSheetStyles()}
  </style>
</head>
<body>
  <div class="label-pdf-root">
    ${getLabelSheetMarkup(label, media.qr, media.barcode, branding, mode)}
  </div>
  <script>
    window.addEventListener('load', () => {
      const imgs = Array.from(document.images);
      let loaded = 0;
      const done = () => { window.print(); setTimeout(() => window.close(), 300); };
      if (!imgs.length) return done();
      imgs.forEach(img => {
        if (img.complete) { loaded++; if (loaded === imgs.length) done(); }
        else img.onload = img.onerror = () => {
          loaded++;
          if (loaded === imgs.length) done();
        };
      });
    });
  </script>
</body>
</html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  async function openPrintLabelsForBatch(
    items,
    title = '',
    brandingInput = 'gob',
    modeInput = LABEL_PRINT_MODE.QR
  ) {
    const batch = getPrintableLabelBatch(items)
    if (!batch.length) return
    const mode = normalizeLabelPrintMode(modeInput)
    const branding = resolveLabelBranding(brandingInput)
    const win = window.open('', '_blank', 'width=640,height=520')
    if (!win) {
      setErr('El navegador bloqueo la ventana de impresion.')
      return
    }

    const qrModule = mode === LABEL_PRINT_MODE.QR ? await loadQrCodeLib() : null
    const QRCode = qrModule?.default || null
    const sheets = []
    for (const item of batch) {
      const label = getLabelData(item)
      const media = await buildLabelMediaForMode(label, QRCode, mode)
      sheets.push(
        `<div class="label-pdf-root label-page">${getLabelSheetMarkup(
          label,
          media.qr,
          media.barcode,
          branding,
          mode
        )}</div>`
      )
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title || `Etiquetas lote (${batch.length})`)}</title>
  <style>
    @page { size: ${LABEL.widthMm}mm ${LABEL.heightMm}mm; margin: 0; }
    ${getSingleLabelSheetStyles()}
    html, body {
      margin: 0;
      padding: 0;
      width: ${LABEL.widthMm}mm;
      min-width: ${LABEL.widthMm}mm;
      max-width: ${LABEL.widthMm}mm;
      background: #fff;
      overflow: hidden;
    }
    .label-page {
      break-after: page;
      break-inside: avoid;
      width: ${LABEL.widthMm}mm;
      height: ${LABEL.heightMm}mm;
      overflow: hidden;
    }
    .label-page:last-child {
      break-after: auto;
    }
  </style>
</head>
<body>${sheets.join('\n')}
  <script>
    window.addEventListener('load', () => {
      const imgs = Array.from(document.images);
      let loaded = 0;
      const done = () => { window.print(); setTimeout(() => window.close(), 300); };
      if (!imgs.length) return done();
      imgs.forEach(img => {
        if (img.complete) { loaded++; if (loaded === imgs.length) done(); }
        else img.onload = img.onerror = () => {
          loaded++;
          if (loaded === imgs.length) done();
        };
      });
    });
  </script>
</body>
</html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  async function openPrintBatchLabels() {
    return openPrintLabelsForBatch(createdAssetBatch)
  }

  async function openPrintBlankBarcodeSequence(startCodeInput, sequenceInput, residenceNameInput = '') {
    try {
      const hasStartCodeInput = String(startCodeInput ?? '').trim() !== ''
      const startCode = Number(startCodeInput)
      const groups = Array.isArray(sequenceInput)
        ? sequenceInput.map((group) => ({
            residenceName: String(group?.residenceName || '').replace(/\s+/g, ' ').trim(),
            quantity: Number(group?.quantity),
          }))
        : [
            {
              residenceName: String(residenceNameInput || '').replace(/\s+/g, ' ').trim(),
              quantity: Number(sequenceInput),
            },
          ]

      if (!hasStartCodeInput || !Number.isInteger(startCode) || startCode <= 0) {
        setErr('Ingresa el primer VAL a imprimir como numero valido.')
        return
      }
      if (!groups.length) {
        setErr('Agrega al menos una residencia para imprimir etiquetas.')
        return
      }
      const invalidGroup = groups.find(
        (group) =>
          !group.residenceName || !Number.isInteger(group.quantity) || group.quantity <= 0
      )
      if (invalidGroup) {
        setErr('Cada residencia debe tener nombre y cantidad valida de etiquetas.')
        return
      }
      const totalQuantity = groups.reduce((sum, group) => sum + group.quantity, 0)
      if (totalQuantity > 1000) {
        setErr('Ingresa una cantidad total entre 1 y 1000 etiquetas.')
        return
      }
      const lastCode = startCode + totalQuantity - 1
      if (lastCode > 9999999) {
        setErr('El rango supera el maximo permitido para VAL de 7 digitos.')
        return
      }

      const labels = []
      let nextCode = startCode
      groups.forEach((group) => {
        for (let index = 0; index < group.quantity; index += 1) {
          labels.push({
            id: `blank-${nextCode}`,
            internalCode: nextCode,
            name: '',
            blankTemplate: true,
            residenceName: group.residenceName,
            isDeleted: false,
            assetState: { name: 'ACTIVO' },
          })
          nextCode += 1
        }
      })

      await openPrintLabelsForBatch(
        labels,
        `Etiquetas VAL ${formatLabelCode(startCode)} a ${formatLabelCode(lastCode)}`,
        'gob',
        LABEL_PRINT_MODE.BARCODE
      )
    } catch (err) {
      setErr(err)
    }
  }
  function buildAssetLabelFilterParams(filters) {
    const params = new URLSearchParams()
    const safeId = toPositiveIntOrNull(filters.id)
    if (filters.id && !safeId) {
      throw new Error('Filtro ID invalido. Usa solo numeros positivos.')
    }
    if (safeId) params.set('id', String(safeId))
    if (filters.internalCode) params.set('internalCode', filters.internalCode)
    if (filters.q) params.set('q', filters.q)
    if (filters.responsibleName) params.set('responsibleName', filters.responsibleName)
    if (filters.costCenter) params.set('costCenter', filters.costCenter)
    if (filters.institutionId) params.set('institutionId', filters.institutionId)
    if (filters.establishmentId) params.set('establishmentId', filters.establishmentId)
    if (filters.dependencyId) params.set('dependencyId', filters.dependencyId)
    if (filters.assetStateId) params.set('assetStateId', filters.assetStateId)
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    return params
  }

  async function fetchAssetListBatchForLabels(filterOverrides = {}) {
    const filters = { ...assetListFilters, ...filterOverrides }
    const baseParams = buildAssetLabelFilterParams(filters)
    const pageSize = 100
    const maxLabels = 1000
    const items = []
    let total = null

    for (let skip = 0; skip < maxLabels; skip += pageSize) {
      const params = new URLSearchParams(baseParams)
      params.set('take', String(pageSize))
      params.set('skip', String(skip))
      params.set('withCount', skip === 0 ? 'true' : 'false')
      const data = await api(`/assets?${params.toString()}`)
      const pageItems = data.items || []
      if (skip === 0) {
        total = Number(data.total || 0)
        if (total > maxLabels) {
          throw new Error(`La seleccion contiene ${total} activos. Filtra a ${maxLabels} o menos por impresion.`)
        }
      }
      items.push(...pageItems)
      if (pageItems.length < pageSize || items.length >= total) break
    }

    return items
  }

  async function openPrintAssetListQrLabels(filterOverrides = {}) {
    try {
      const filters = { ...assetListFilters, ...filterOverrides }
      if (!filters.institutionId) {
        setErr('Selecciona una institucion antes de imprimir etiquetas masivamente.')
        return
      }
      const items = await fetchAssetListBatchForLabels(filterOverrides)
      if (!items.length) {
        setErr('No hay activos fijos filtrados para imprimir QR.')
        return
      }
      await openPrintLabelsForBatch(
        items,
        `Etiquetas QR activos (${items.length})`,
        'gob',
        LABEL_PRINT_MODE.QR
      )
    } catch (err) {
      setErr(err)
    }
  }

  async function openPrintAssetListBarcodeLabels(filterOverrides = {}) {
    try {
      const filters = { ...assetListFilters, ...filterOverrides }
      if (!filters.institutionId) {
        setErr('Selecciona una institucion antes de imprimir etiquetas masivamente.')
        return
      }
      const items = await fetchAssetListBatchForLabels(filterOverrides)
      if (!items.length) {
        setErr('No hay activos fijos filtrados para imprimir barras.')
        return
      }
      await openPrintLabelsForBatch(
        items,
        `Etiquetas barra activos (${items.length})`,
        'gob',
        LABEL_PRINT_MODE.BARCODE
      )
    } catch (err) {
      setErr(err)
    }
  }
  function toggleSelectedAsset(assetId) {
    const safeId = toPositiveIntOrNull(assetId)
    if (!safeId) return
    setSelectedAssetIds((prev) =>
      prev.includes(safeId) ? prev.filter((id) => id !== safeId) : [...prev, safeId]
    )
  }

  function toggleSelectAllVisibleAssets() {
    const visibleIds = (assetsList || [])
      .map((asset) => toPositiveIntOrNull(asset.id))
      .filter(Boolean)
    if (!visibleIds.length) return
    setSelectedAssetIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.includes(id))
      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id))
      }
      const next = new Set(prev)
      visibleIds.forEach((id) => next.add(id))
      return Array.from(next)
    })
  }

  function clearSelectedAssets() {
    setSelectedAssetIds([])
  }

  async function openPrintSelectedAssetQrLabels() {
    try {
      const selectedItems = (assetsList || []).filter((asset) =>
        selectedAssetIds.includes(toPositiveIntOrNull(asset.id))
      )
      if (!selectedItems.length) {
        setErr('Selecciona al menos un activo fijo visible para imprimir QR.')
        return
      }
      await openPrintLabelsForBatch(
        selectedItems,
        `Etiquetas QR seleccionadas (${selectedItems.length})`,
        'gob',
        LABEL_PRINT_MODE.QR
      )
    } catch (err) {
      setErr(err)
    }
  }

  async function openPrintSelectedAssetBarcodeLabels() {
    try {
      const selectedItems = (assetsList || []).filter((asset) =>
        selectedAssetIds.includes(toPositiveIntOrNull(asset.id))
      )
      if (!selectedItems.length) {
        setErr('Selecciona al menos un activo fijo visible para imprimir barras.')
        return
      }
      await openPrintLabelsForBatch(
        selectedItems,
        `Etiquetas barra seleccionadas (${selectedItems.length})`,
        'gob',
        LABEL_PRINT_MODE.BARCODE
      )
    } catch (err) {
      setErr(err)
    }
  }

  async function openPrintPlanchetaQrLabels(options = {}) {
    try {
      const branding = resolveLabelBranding(options)
      const items = getPrintableLabelBatch(planchetaPreview)
      if (!items.length) {
        setErr('Previsualiza planchetas con activos antes de imprimir QR.')
        return
      }
      await openPrintLabelsForBatch(
        items,
        `Etiquetas QR plancheta (${items.length})`,
        branding.key,
        LABEL_PRINT_MODE.QR
      )
    } catch (err) {
      setErr(err)
    }
  }

  async function openPrintPlanchetaBarcodeLabels(options = {}) {
    try {
      const branding = resolveLabelBranding(options)
      const items = getPrintableLabelBatch(planchetaPreview)
      if (!items.length) {
        setErr('Previsualiza planchetas con activos antes de imprimir barras.')
        return
      }
      await openPrintLabelsForBatch(
        items,
        `Etiquetas barra plancheta (${items.length})`,
        branding.key,
        LABEL_PRINT_MODE.BARCODE
      )
    } catch (err) {
      setErr(err)
    }
  }

  function normalizeScannedAssetReference(rawValue) {
    const raw = String(rawValue || '').trim()
    if (!raw) return null
    const absolutePublicUrlMatch = raw.match(
      /^https?:\/\/[^/\s]+\/(?:api\/)?assets\/public\/(\d+)\/(?:ficha\.html|technical-sheet)/i
    )
    if (absolutePublicUrlMatch?.[1]) {
      return {
        kind: 'assetId',
        assetId: Number(absolutePublicUrlMatch[1]),
        internalCode: null,
        publicUrl: buildAssetTechnicalSheetUrl({ id: Number(absolutePublicUrlMatch[1]) }),
      }
    }
    const htmlPathMatch = raw.match(/\/assets\/public\/(\d+)\/ficha\.html/i)
    if (htmlPathMatch?.[1]) {
      return {
        kind: 'assetId',
        assetId: Number(htmlPathMatch[1]),
        internalCode: null,
        publicUrl: buildAssetTechnicalSheetUrl({ id: Number(htmlPathMatch[1]) }),
      }
    }
    const pathMatch = raw.match(/\/assets\/public\/(\d+)\/technical-sheet/i)
    if (pathMatch?.[1]) {
      return {
        kind: 'assetId',
        assetId: Number(pathMatch[1]),
        internalCode: null,
        publicUrl: buildAssetTechnicalSheetUrl({ id: Number(pathMatch[1]) }),
      }
    }
    const queryId = raw.match(/[?&]assetId=(\d{1,12})/i)
    if (queryId?.[1]) {
      return {
        kind: 'assetId',
        assetId: Number(queryId[1]),
        internalCode: null,
        publicUrl: null,
      }
    }
    const direct = Number(raw)
    if (Number.isFinite(direct) && direct > 0) {
      return {
        kind: 'internalCode',
        internalCode: Math.trunc(direct),
        assetId: null,
        publicUrl: null,
      }
    }
    const invMatch = raw.match(/INV[-_\s]?(\d{1,12})/i)
    if (invMatch?.[1]) {
      return {
        kind: 'internalCode',
        internalCode: Number(invMatch[1]),
        assetId: null,
        publicUrl: null,
      }
    }
    const mauMatch = raw.match(/VAL[-_\s]?0*(\d{1,12})/i)
    if (mauMatch?.[1]) {
      return {
        kind: 'internalCode',
        internalCode: Number(mauMatch[1]),
        assetId: null,
        publicUrl: null,
      }
    }
    const anyDigits = raw.match(/(\d{1,12})/)
    if (anyDigits?.[1]) {
      return {
        kind: 'internalCode',
        internalCode: Number(anyDigits[1]),
        assetId: null,
        publicUrl: null,
      }
    }
    return null
  }

  async function getAssetByScanReference(reference) {
    if (!reference) return null
    if (reference.assetId) {
      try {
        return await api(`/assets/${reference.assetId}`)
      } catch (err) {
        if (err?.status === 404) return null
        throw err
      }
    }
    if (reference.internalCode) {
      const params = new URLSearchParams()
      params.set('internalCode', String(reference.internalCode))
      params.set('take', '1')
      params.set('skip', '0')
      params.set('withCount', 'false')
      const data = await api(`/assets?${params.toString()}`)
      return (data.items || [])[0] || null
    }
    return null
  }

  function openAssetModal(asset) {
    selectAssetForModal(asset)
  }

  async function resolveScannedAsset() {
    const reference = normalizeScannedAssetReference(scanInput)
    if (!reference) {
      setScanResult({
        status: 'error',
        message: 'Ingresa o escanea un codigo QR valido para continuar.',
      })
      return
    }
    try {
      setScanResult(null)
      const asset = await getAssetByScanReference(reference)
      if (!asset) {
        setScanResult({
          status: 'error',
          message:
            reference.kind === 'internalCode'
              ? 'No se encontro un activo fijo para el codigo interno ingresado.'
              : 'No se encontro un activo fijo para el QR escaneado.',
        })
        return
      }
      openAssetModal(asset, { focusTechnicalSheet: true })
      setOk(`Activo fijo cargado desde QR: ${formatLabelCode(asset.internalCode)}`)
      setScanResult({
        status: 'ok',
        message: `Activo fijo encontrado: ${formatLabelCode(asset.internalCode)}`,
      })
    } catch (error) {
      setScanResult({
        status: 'error',
        message: getErrorMessage(error, 'No se pudo resolver el codigo QR escaneado.'),
      })
    }
  }

  function copyTechnicalSheetLink() {
    const technicalSheetUrl =
      createdLabel?.technicalSheetUrl || labelData?.technicalSheetUrl || ''
    if (!technicalSheetUrl) {
      setErr('No hay ficha tecnica disponible para copiar.')
      return
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(technicalSheetUrl)
        .then(() => setOk('Enlace de ficha tecnica copiado al portapapeles.'))
        .catch(() => setErr('Tu navegador no permite copiar al portapapeles en este contexto.'))
      return
    }
    setErr('Tu navegador no permite copiar al portapapeles en este contexto.')
  }

  useEffect(() => {
    if (!createdAsset?.internalCode) {
      setQrCodeUrl('')
      return
    }
    const barcodeValue = formatLabelCode(createdAsset.internalCode)
    const qrValue = buildAssetTechnicalSheetUrl(createdAsset) || barcodeValue
    let cancelled = false

    Promise.all([loadQrCodeLib(), loadJsBarcodeLib()])
      .then(([qrModule, barcodeModule]) => {
        if (cancelled) return
        qrModule.default
          .toDataURL(qrValue, { margin: 1, width: 180 })
          .then((url) => {
            if (!cancelled) setQrCodeUrl(url)
          })
          .catch(() => {
            if (!cancelled) setQrCodeUrl('')
          })
        const element = document.getElementById('barcode-preview')
        if (element) {
          try {
            barcodeModule.default(element, barcodeValue, {
              format: 'CODE128',
              displayValue: false,
              height: 48,
              margin: 0,
              lineColor: '#000000',
              background: '#ffffff',
            })
          } catch {
            // ignore barcode errors
          }
        }
      })
      .catch(() => {
        if (!cancelled) setQrCodeUrl('')
      })

    return () => {
      cancelled = true
    }
  }, [createdAsset, loadJsBarcodeLib, loadQrCodeLib, setQrCodeUrl])

  const labelData = createdAsset ? getLabelData(createdAsset) : null
  const createdLabel = createdAsset ? getLabelData(createdAsset) : null

  return {
    labelData,
    createdLabel,
    downloadLabelPdf,
    openPrintLabel,
    openPrintBatchLabels,
    openPrintBlankBarcodeSequence,
    openPrintAssetListQrLabels,
    openPrintAssetListBarcodeLabels,
    openPrintAssetListLabels: openPrintAssetListQrLabels,
    toggleSelectedAsset,
    toggleSelectAllVisibleAssets,
    clearSelectedAssets,
    openPrintSelectedAssetQrLabels,
    openPrintSelectedAssetBarcodeLabels,
    openPrintSelectedAssetLabels: openPrintSelectedAssetQrLabels,
    openPrintPlanchetaQrLabels,
    openPrintPlanchetaBarcodeLabels,
    openPrintPlanchetaLabels: openPrintPlanchetaQrLabels,
    resolveScannedAsset,
    copyTechnicalSheetLink,
  }
}

export default useAssetLabelsAndScan
