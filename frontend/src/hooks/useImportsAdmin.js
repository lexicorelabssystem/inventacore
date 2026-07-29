import { useEffect, useRef, useState } from 'react'
import { UI_ERROR, UI_STATUS, UI_SUCCESS } from '../constants/uiMessages'
import { UI_TEXT } from '../constants/uiText'

function normalizeImportJobPayload(data) {
  if (!data) return null
  return {
    ...data,
    metrics: data.metrics || data.errors?.metrics || null,
    errorItems: data.errorItems || data.errors?.items || [],
  }
}

function normalizePreviewHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function isImportPlaceholderValue(value, importPlaceholderValues) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
  return importPlaceholderValues.has(normalized)
}

function normalizeSnCell(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSnInventoryRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return {
      rowsRead: 0,
      blockCount: 0,
      items: [],
      catalogItems: [],
    }
  }

  const headerRowIndex = rows.findIndex((row) => {
    const values = (row || []).map((cell) => normalizeSnCell(cell).toLowerCase())
    return values.includes('insumo') && values.includes('cantidad')
  })

  if (headerRowIndex < 0) {
    throw new Error(
      'Formato SN no detectado: debe incluir una fila con columnas Insumo y Cantidad.'
    )
  }

  const headerRow = rows[headerRowIndex] || []
  const categoryRow = rows[headerRowIndex + 1] || []
  const dataRows = rows.slice(headerRowIndex + 2)

  const insumoCols = []
  const cantidadCols = []
  headerRow.forEach((cell, idx) => {
    const key = normalizeSnCell(cell).toLowerCase()
    if (key === 'insumo') insumoCols.push(idx)
    if (key === 'cantidad') cantidadCols.push(idx)
  })

  const blocks = insumoCols
    .map((nameCol) => {
      const qtyCol = cantidadCols.find((column) => column > nameCol && column <= nameCol + 2)
      return qtyCol !== undefined ? { nameCol, qtyCol } : null
    })
    .filter(Boolean)

  const categoryByCol = {}
  let currentCategory = 'SIN_CATEGORIA'
  for (let col = 0; col < categoryRow.length; col += 1) {
    const value = normalizeSnCell(categoryRow[col])
    if (value) currentCategory = value
    categoryByCol[col] = currentCategory
  }

  const grouped = new Map()
  dataRows.forEach((row) => {
    blocks.forEach(({ nameCol, qtyCol }) => {
      const name = normalizeSnCell(row?.[nameCol])
      if (!name) return
      const rawQty = normalizeSnCell(row?.[qtyCol]).replace(',', '.')
      const quantity = Number(rawQty)
      if (!Number.isFinite(quantity) || quantity <= 0) return

      const category =
        normalizeSnCell(categoryByCol[nameCol] || categoryByCol[qtyCol]) || 'SIN_CATEGORIA'
      const key = `${category.toUpperCase()}::${name.toUpperCase()}`
      const current = grouped.get(key) || { category, name, quantity: 0, rows: 0 }
      current.quantity += quantity
      current.rows += 1
      grouped.set(key, current)
    })
  })

  const items = Array.from(grouped.values()).sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category, 'es')
    if (byCategory !== 0) return byCategory
    return a.name.localeCompare(b.name, 'es')
  })

  const catalogItems = items.map((item) => ({
    name: item.name,
    category: item.category,
    subcategory: 'BASE_SN',
    description: `Base SN | Cantidad referencial: ${item.quantity}`,
    unit: 'unidad',
  }))

  return {
    rowsRead: dataRows.length,
    blockCount: blocks.length,
    items,
    catalogItems,
  }
}

function useImportsAdmin({
  api,
  setErr,
  setOk,
  activeTab,
  importsView,
  loadXlsxLib,
  apiBase,
  token,
  getCatalogConflictMessage,
  withMappedError,
  catalogAdminTake,
  importRequiredGroups,
  importPlaceholderValues,
}) {
  const [importFile, setImportFile] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importErrors, setImportErrors] = useState([])
  const [importSchemaDetails, setImportSchemaDetails] = useState(null)
  const [previewHeaders, setPreviewHeaders] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [previewMissing, setPreviewMissing] = useState([])
  const [previewInvalidCells, setPreviewInvalidCells] = useState({})
  const [catalogImportFile, setCatalogImportFile] = useState(null)
  const [catalogImportLoading, setCatalogImportLoading] = useState(false)
  const [catalogImportResult, setCatalogImportResult] = useState(null)
  const [catalogImportErrors, setCatalogImportErrors] = useState([])
  const [snBaseFile, setSnBaseFile] = useState(null)
  const [snBaseLoading, setSnBaseLoading] = useState(false)
  const [snBaseParsed, setSnBaseParsed] = useState(null)
  const [snBaseImporting, setSnBaseImporting] = useState(false)
  const [snBaseImportResult, setSnBaseImportResult] = useState(null)
  const [catalogManualForm, setCatalogManualForm] = useState({
    officialKey: '',
    name: '',
    category: '',
    subcategory: '',
    brand: '',
    modelName: '',
    description: '',
    unit: 'unidad',
  })
  const [catalogAdminItems, setCatalogAdminItems] = useState([])
  const [catalogAdminOriginal, setCatalogAdminOriginal] = useState({})
  const [catalogAdminLoading, setCatalogAdminLoading] = useState(false)
  const [catalogAdminQuery, setCatalogAdminQuery] = useState('')
  const [catalogAdminPage, setCatalogAdminPage] = useState(1)
  const [catalogAdminTotal, setCatalogAdminTotal] = useState(0)
  const [catalogAdminRowStatus, setCatalogAdminRowStatus] = useState({})
  const [catalogAdminKeyStatus, setCatalogAdminKeyStatus] = useState({})
  const [manualOfficialKeyCheck, setManualOfficialKeyCheck] = useState(null)
  const [importHistory, setImportHistory] = useState([])
  const [importHistoryPage, setImportHistoryPage] = useState(1)
  const [importHistoryTotal, setImportHistoryTotal] = useState(0)
  const [importHistoryLoading, setImportHistoryLoading] = useState(false)
  const [importHistoryOpen, setImportHistoryOpen] = useState(null)
  const [importHistoryFilters, setImportHistoryFilters] = useState({
    fromDate: '',
    toDate: '',
    userId: '',
  })
  const importJobPollRef = useRef(null)
  const catalogKeyCheckTimers = useRef({})

  function stopImportJobPolling() {
    if (importJobPollRef.current) {
      clearTimeout(importJobPollRef.current)
      importJobPollRef.current = null
    }
  }

  function scheduleImportJobPoll(batchId) {
    stopImportJobPolling()
    const pollDelayMs = document.visibilityState === 'visible' ? 5000 : 15000
    importJobPollRef.current = setTimeout(() => {
      loadImportJobStatus(batchId, { silent: true }).catch((err) => {
        if (err?.status === 429) {
          scheduleImportJobPoll(batchId)
        }
      })
    }, pollDelayMs)
  }

  async function fetchCatalogIds() {
    const [establishments, dependencies, assetStates, assetTypes] = await Promise.all([
      api('/catalog/establishments?take=100'),
      api('/catalog/dependencies?take=100'),
      api('/catalog/asset-states?take=100'),
      api('/catalog/asset-types?take=100'),
    ])
    return {
      establishments: new Set((establishments.items || []).map((item) => item.id)),
      dependencies: new Set((dependencies.items || []).map((item) => item.id)),
      assetStates: new Set((assetStates.items || []).map((item) => item.id)),
      assetTypes: new Set((assetTypes.items || []).map((item) => item.id)),
    }
  }

  async function handleSnBaseFileChange(file) {
    setSnBaseFile(file || null)
    setSnBaseImportResult(null)
    if (!file) {
      setSnBaseParsed(null)
      return
    }
    setSnBaseLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const XLSX = await loadXlsxLib()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('El archivo no contiene hojas para procesar.')
      }
      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      const parsed = parseSnInventoryRows(rows)
      setSnBaseParsed(parsed)
    } catch (err) {
      setSnBaseParsed(null)
      setErr(err, 'No se pudo leer el formato Base Inventario SN.')
    } finally {
      setSnBaseLoading(false)
    }
  }

  async function handleSnBaseImportToCatalog() {
    if (!snBaseParsed?.catalogItems?.length) {
      setErr('Primero carga y analiza un archivo Base SN valido.')
      return
    }
    setSnBaseImporting(true)
    setSnBaseImportResult(null)
    try {
      const result = await api('/admin/catalog-items/bulk', {
        method: 'POST',
        body: { items: snBaseParsed.catalogItems },
      })
      setSnBaseImportResult(result)
      setOk('Base SN convertida e importada a catalogo.')
      if (activeTab === 'imports' && importsView === 'catalog') {
        await loadCatalogAdminItems(1)
      }
    } catch (err) {
      setErr(err, 'No se pudo importar Base SN al catalogo.')
    } finally {
      setSnBaseImporting(false)
    }
  }

  async function handlePreviewFile(file) {
    if (!file) {
      setPreviewHeaders([])
      setPreviewRows([])
      setPreviewMissing([])
      setPreviewInvalidCells({})
      return
    }
    try {
      const buffer = await file.arrayBuffer()
      const XLSX = await loadXlsxLib()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        setPreviewHeaders([])
        setPreviewRows([])
        setPreviewMissing([])
        setPreviewInvalidCells({})
        return
      }
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      const detectedHeaderIndex = rows.slice(0, 50).findIndex((row) => {
        if (!Array.isArray(row)) return false
        const keys = row.map((value) => normalizePreviewHeader(value))
        const hasCode = keys.includes('codigo') || keys.includes('codigomau') || keys.includes('codigointerno')
        const hasName = keys.includes('nombre') || keys.includes('nombredelbien')
        return hasCode && hasName && keys.includes('cantidad')
      })
      const headerIndex = detectedHeaderIndex >= 0 ? detectedHeaderIndex : 0
      const headers = Array.isArray(rows[headerIndex]) ? rows[headerIndex] : []
      const normalized = headers.map((header) => normalizePreviewHeader(header))
      const missing = []

      const preview = rows.slice(headerIndex + 1, headerIndex + 11)
      const invalidMap = {}
      const columnIndexByKey = {}
      normalized.forEach((key, idx) => {
        columnIndexByKey[key] = idx
      })

      let catalogSets = null
      if (token) {
        try {
          catalogSets = await fetchCatalogIds()
        } catch {
          catalogSets = null
        }
      }

      preview.forEach((row, rowIdx) => {
        const base = rowIdx + 1
        const invalidCols = []
        importRequiredGroups.forEach((group) => {
          const normalizedKeys = group.keys.map((key) => normalizePreviewHeader(key))
          const colIdx = normalizedKeys
            .map((key) => columnIndexByKey[key])
            .find((idx) => idx !== undefined)
          if (colIdx === undefined) return
          const value = row[colIdx]
          const str = String(value || '').trim()
          if (!str) return
          if (group.label === 'Valor Adquisicion') {
            if (isImportPlaceholderValue(value, importPlaceholderValues)) return
            const num = Number(value)
            if (!Number.isFinite(num) || num <= 0) invalidCols.push(colIdx)
          }
          if (
            group.label === 'Fecha Adquisicion' &&
            isImportPlaceholderValue(value, importPlaceholderValues)
          ) {
            return
          }
        })

        if (catalogSets) {
          const idChecks = [
            { key: 'establishmentid', set: catalogSets.establishments },
            { key: 'dependencyid', set: catalogSets.dependencies },
            { key: 'assetstateid', set: catalogSets.assetStates },
            { key: 'assettypeid', set: catalogSets.assetTypes },
          ]
          idChecks.forEach((check) => {
            const colIdx = columnIndexByKey[check.key]
            if (colIdx === undefined) return
            const raw = String(row[colIdx] || '').trim()
            if (!raw) return
            const value = Number(row[colIdx])
            if (!Number.isFinite(value) || !check.set.has(value)) {
              invalidCols.push(colIdx)
            }
          })
        }

        if (invalidCols.length) {
          invalidMap[base] = Array.from(new Set(invalidCols))
        }
      })

      setPreviewHeaders(headers)
      setPreviewRows(preview)
      setPreviewMissing(missing)
      setPreviewInvalidCells(invalidMap)
    } catch {
      setPreviewHeaders([])
      setPreviewRows([])
      setPreviewMissing([])
      setPreviewInvalidCells({})
    }
  }

  async function handleImportUpload() {
    if (!importFile) {
      setErr('Selecciona un archivo .xlsx antes de importar.')
      return
    }

    setImportLoading(true)
    setImportResult(null)
    setImportSchemaDetails(null)
    setImportErrors([])
    stopImportJobPolling()

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const res = await fetch(`${apiBase}/assets/import/excel`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }

      if (!res.ok) {
        if (json?.code === 'IMPORT_SCHEMA') {
          setImportSchemaDetails(json?.details || json)
        }
        const msg = json?.error || text || `HTTP ${res.status}`
        throw new Error(msg)
      }

      const normalized = normalizeImportJobPayload(json)
      setImportResult(normalized)
      setImportErrors(normalized?.errorItems || [])
      if (normalized?.status === 'PROCESSING' && normalized?.id) {
        loadImportHistory(1)
        scheduleImportJobPoll(normalized.id)
        setOk('Importacion en proceso por bloques.')
      } else {
        setImportLoading(false)
        setOk(UI_STATUS.importCompleted)
      }
    } catch (err) {
      stopImportJobPolling()
      setImportLoading(false)
      setErr(err, 'Error al importar Excel.')
    }
  }

  async function handleCatalogImportUpload() {
    if (!catalogImportFile) {
      setErr('Selecciona un archivo de catalogo (.xlsx) antes de importar.')
      return
    }

    setCatalogImportLoading(true)
    setCatalogImportResult(null)
    setCatalogImportErrors([])

    try {
      const formData = new FormData()
      formData.append('file', catalogImportFile)

      const res = await fetch(`${apiBase}/admin/catalog-items/import/excel`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }

      if (!res.ok) {
        const msg = json?.error || text || `HTTP ${res.status}`
        throw new Error(msg)
      }

      setCatalogImportResult(json)
      setCatalogImportErrors(json?.errors || [])
      setOk(UI_STATUS.catalogBulkImportCompleted)
    } catch (err) {
      setErr(err, 'Error al importar catalogo por Excel.')
    } finally {
      setCatalogImportLoading(false)
    }
  }

  async function handleCatalogManualCreate() {
    try {
      const payload = {
        officialKey: catalogManualForm.officialKey.trim() || undefined,
        name: catalogManualForm.name.trim(),
        category: catalogManualForm.category.trim(),
        subcategory: catalogManualForm.subcategory.trim() || undefined,
        brand: catalogManualForm.brand.trim() || undefined,
        modelName: catalogManualForm.modelName.trim() || undefined,
        description: catalogManualForm.description.trim() || undefined,
        unit: catalogManualForm.unit.trim() || undefined,
      }

      await api('/admin/catalog-items', { method: 'POST', body: payload })
      setCatalogManualForm({
        officialKey: '',
        name: '',
        category: '',
        subcategory: '',
        brand: '',
        modelName: '',
        description: '',
        unit: 'unidad',
      })
      await loadCatalogAdminItems(catalogAdminPage)
      setManualOfficialKeyCheck(null)
      setOk('Item de catalogo creado manualmente.')
    } catch (err) {
      const message = getCatalogConflictMessage(err, 'No se pudo crear el item de catalogo.')
      setErr(withMappedError(err, message, 'No se pudo crear el item de catalogo.'))
    }
  }

  async function checkManualOfficialKeyAvailability() {
    const raw = catalogManualForm.officialKey?.trim()
    if (!raw) {
      setManualOfficialKeyCheck({
        type: 'info',
        message: 'No hay officialKey para validar.',
      })
      return
    }
    try {
      const params = new URLSearchParams()
      params.set('officialKey', raw)
      const data = await api(`/admin/catalog-items/official-key-availability?${params.toString()}`)
      if (data.available) {
        setManualOfficialKeyCheck({
          type: 'ok',
          message: `Disponible (${data.normalizedOfficialKey}).`,
        })
      } else {
        setManualOfficialKeyCheck({
          type: 'error',
          message: `En uso por #${data.conflictItem?.id} (${data.conflictItem?.name || 'sin nombre'}).`,
        })
      }
    } catch (err) {
      setManualOfficialKeyCheck({
        type: 'error',
        message: err?.message || 'No se pudo validar officialKey.',
      })
    }
  }

  async function loadCatalogAdminItems(page = catalogAdminPage) {
    setCatalogAdminLoading(true)
    try {
      const safePage = Number(page)
      const normalizedPage = Number.isFinite(safePage) && safePage > 0 ? safePage : 1
      const skip = (normalizedPage - 1) * catalogAdminTake
      const params = new URLSearchParams()
      params.set('take', String(catalogAdminTake))
      params.set('skip', String(skip))
      if (catalogAdminQuery.trim()) params.set('q', catalogAdminQuery.trim())
      const data = await api(`/admin/catalog-items?${params.toString()}`)
      const items = data.items || []
      setCatalogAdminItems(items)
      setCatalogAdminTotal(data.total || 0)
      setCatalogAdminPage(normalizedPage)

      const snapshot = {}
      items.forEach((item) => {
        snapshot[item.id] = {
          officialKey: item.officialKey || '',
          name: item.name || '',
          category: item.category || '',
          subcategory: item.subcategory || '',
          brand: item.brand || '',
          modelName: item.modelName || '',
          unit: item.unit || '',
        }
      })
      setCatalogAdminOriginal(snapshot)
      setCatalogAdminRowStatus({})
      setCatalogAdminKeyStatus({})
    } catch (err) {
      setErr(err, UI_ERROR.couldNotLoad('items de catalogo'))
    } finally {
      setCatalogAdminLoading(false)
    }
  }

  async function updateCatalogAdminItem(item) {
    try {
      setCatalogAdminRowStatus((prev) => ({
        ...prev,
        [item.id]: { type: 'info', message: UI_TEXT.saving },
      }))
      const body = {
        officialKey: item.officialKey?.trim() || undefined,
        name: item.name?.trim() || undefined,
        category: item.category?.trim() || undefined,
        subcategory: item.subcategory?.trim() || undefined,
        brand: item.brand?.trim() || undefined,
        modelName: item.modelName?.trim() || undefined,
        unit: item.unit?.trim() || undefined,
      }
      const updated = await api(`/admin/catalog-items/${item.id}`, { method: 'PUT', body })
      setCatalogAdminItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row))
      )
      setCatalogAdminOriginal((prev) => ({
        ...prev,
        [item.id]: {
          officialKey: updated.officialKey || '',
          name: updated.name || '',
          category: updated.category || '',
          subcategory: updated.subcategory || '',
          brand: updated.brand || '',
          modelName: updated.modelName || '',
          unit: updated.unit || '',
        },
      }))
      setCatalogAdminRowStatus((prev) => ({
        ...prev,
        [item.id]: { type: 'ok', message: 'Guardado' },
      }))
      setOk(UI_SUCCESS.catalogItemUpdated(item.id))
    } catch (err) {
      const message = getCatalogConflictMessage(err, 'Error al guardar')
      setCatalogAdminRowStatus((prev) => ({
        ...prev,
        [item.id]: { type: 'error', message },
      }))
      setErr(withMappedError(err, message, 'Error al guardar'))
    }
  }

  async function validateCatalogAdminOfficialKey(itemId, rawOfficialKey) {
    const officialKey = String(rawOfficialKey || '').trim()
    if (!officialKey) {
      setCatalogAdminKeyStatus((prev) => ({
        ...prev,
        [itemId]: { type: 'info', message: '' },
      }))
      return
    }

    try {
      setCatalogAdminKeyStatus((prev) => ({
        ...prev,
        [itemId]: { type: 'info', message: 'Validando officialKey...' },
      }))
      const params = new URLSearchParams()
      params.set('officialKey', officialKey)
      params.set('excludeId', String(itemId))
      const data = await api(`/admin/catalog-items/official-key-availability?${params.toString()}`)
      if (data.available) {
        setCatalogAdminKeyStatus((prev) => ({
          ...prev,
          [itemId]: { type: 'ok', message: 'officialKey disponible' },
        }))
      } else {
        setCatalogAdminKeyStatus((prev) => ({
          ...prev,
          [itemId]: {
            type: 'error',
            message: `officialKey en uso por #${data.conflictItem?.id || '?'}`,
          },
        }))
      }
    } catch (err) {
      setCatalogAdminKeyStatus((prev) => ({
        ...prev,
        [itemId]: {
          type: 'error',
          message: err?.message || 'No se pudo validar officialKey',
        },
      }))
    }
  }

  function scheduleCatalogAdminOfficialKeyValidation(itemId, officialKey) {
    if (catalogKeyCheckTimers.current[itemId]) {
      clearTimeout(catalogKeyCheckTimers.current[itemId])
    }
    catalogKeyCheckTimers.current[itemId] = setTimeout(() => {
      validateCatalogAdminOfficialKey(itemId, officialKey)
    }, 300)
  }

  function discardCatalogAdminItem(itemId) {
    const original = catalogAdminOriginal[itemId]
    if (!original) return
    if (catalogKeyCheckTimers.current[itemId]) {
      clearTimeout(catalogKeyCheckTimers.current[itemId])
      delete catalogKeyCheckTimers.current[itemId]
    }
    setCatalogAdminItems((prev) =>
      prev.map((row) =>
        row.id === itemId
          ? {
              ...row,
              officialKey: original.officialKey,
              name: original.name,
              category: original.category,
              subcategory: original.subcategory,
              brand: original.brand,
              modelName: original.modelName,
              unit: original.unit,
            }
          : row
      )
    )
    setCatalogAdminRowStatus((prev) => ({
      ...prev,
      [itemId]: { type: 'info', message: 'Cambios descartados' },
    }))
    setCatalogAdminKeyStatus((prev) => ({
      ...prev,
      [itemId]: { type: 'info', message: '' },
    }))
  }

  async function loadImportHistory(page = importHistoryPage) {
    setImportHistoryLoading(true)
    try {
      const take = 10
      const skip = (page - 1) * take
      const params = new URLSearchParams()
      if (importHistoryFilters.fromDate) params.set('fromDate', importHistoryFilters.fromDate)
      if (importHistoryFilters.toDate) params.set('toDate', importHistoryFilters.toDate)
      if (importHistoryFilters.userId) params.set('userId', importHistoryFilters.userId)
      params.set('take', String(take))
      params.set('skip', String(skip))

      const data = await api(`/assets/imports?${params.toString()}`)
      setImportHistory(data.items || [])
      setImportHistoryTotal(data.total || 0)
      setImportHistoryPage(page)
      setImportHistoryOpen(null)
    } catch (err) {
      setErr(err)
    } finally {
      setImportHistoryLoading(false)
    }
  }

  async function loadImportJobStatus(batchId, { silent = false } = {}) {
    const data = normalizeImportJobPayload(await api(`/assets/imports/${batchId}`))
    setImportResult(data)
    setImportErrors(data?.errorItems || [])

    if (data?.status === 'PROCESSING') {
      setImportLoading(true)
      scheduleImportJobPoll(batchId)
      return data
    }

    stopImportJobPolling()
    setImportLoading(false)
    loadImportHistory(1)
    if (data?.status === 'COMPLETED' && !silent) {
      setOk(UI_STATUS.importCompleted)
    }
    if (data?.status === 'FAILED' && !silent) {
      setErr('La importacion quedo incompleta. Puedes revisar el detalle o reanudarla.')
    }
    return data
  }

  async function resumeImportJob(batchId) {
    if (!batchId) return
    setImportLoading(true)
    const data = normalizeImportJobPayload(
      await api(`/assets/imports/${batchId}/retry`, { method: 'POST' })
    )
    setImportResult(data)
    setImportErrors(data?.errorItems || [])
    if (data?.id) {
      scheduleImportJobPoll(data.id)
    }
  }

  useEffect(() => () => stopImportJobPolling(), [])

  useEffect(() => {
    const keyCheckTimers = catalogKeyCheckTimers.current
    return () => {
      Object.values(keyCheckTimers).forEach((timerId) => {
        clearTimeout(timerId)
      })
    }
  }, [])

  return {
    importFile,
    setImportFile,
    importLoading,
    setImportLoading,
    importResult,
    setImportResult,
    importErrors,
    setImportErrors,
    importSchemaDetails,
    setImportSchemaDetails,
    previewHeaders,
    setPreviewHeaders,
    previewRows,
    setPreviewRows,
    previewMissing,
    setPreviewMissing,
    previewInvalidCells,
    setPreviewInvalidCells,
    catalogImportFile,
    setCatalogImportFile,
    catalogImportLoading,
    catalogImportResult,
    catalogImportErrors,
    snBaseFile,
    snBaseLoading,
    snBaseParsed,
    snBaseImporting,
    snBaseImportResult,
    catalogManualForm,
    setCatalogManualForm,
    catalogAdminItems,
    setCatalogAdminItems,
    catalogAdminOriginal,
    catalogAdminLoading,
    catalogAdminQuery,
    setCatalogAdminQuery,
    catalogAdminPage,
    catalogAdminTotal,
    catalogAdminRowStatus,
    catalogAdminKeyStatus,
    manualOfficialKeyCheck,
    setManualOfficialKeyCheck,
    importHistory,
    importHistoryPage,
    importHistoryTotal,
    importHistoryLoading,
    importHistoryOpen,
    setImportHistoryOpen,
    importHistoryFilters,
    setImportHistoryFilters,
    stopImportJobPolling,
    scheduleImportJobPoll,
    handleSnBaseFileChange,
    handleSnBaseImportToCatalog,
    handlePreviewFile,
    handleImportUpload,
    handleCatalogImportUpload,
    handleCatalogManualCreate,
    checkManualOfficialKeyAvailability,
    loadCatalogAdminItems,
    updateCatalogAdminItem,
    validateCatalogAdminOfficialKey,
    scheduleCatalogAdminOfficialKeyValidation,
    discardCatalogAdminItem,
    loadImportHistory,
    loadImportJobStatus,
    resumeImportJob,
  }
}

export default useImportsAdmin
