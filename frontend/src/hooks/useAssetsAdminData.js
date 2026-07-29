function uniqueById(items) {
  const map = new Map()
  for (const item of items || []) {
    const id = item?.id
    if (id === undefined || id === null) continue
    if (!map.has(id)) map.set(id, item)
  }
  return Array.from(map.values())
}

async function collectPagedCatalog(api, path, extraParams = {}) {
  const take = 100
  let skip = 0
  let total = 0
  const collected = []

  do {
    const params = new URLSearchParams()
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      params.set(key, String(value))
    })
    params.set('take', String(take))
    params.set('skip', String(skip))
    params.set('includeInactive', 'true')

    const data = await api(`${path}?${params.toString()}`)
    const items = data.items || []
    total = Number(data.total || 0)
    collected.push(...items)
    skip += take
    if (!items.length) break
  } while (skip < total && collected.length < 10000)

  return uniqueById(collected)
}

function useAssetsAdminData({
  api,
  setErr,
  setOk,
  openConfirm,
  closeConfirm,
  isCentral,
  toPositiveIntOrNull,
  formatCatalogItemDisplay,
  suggestAssetDepreciation,
  assetListPage,
  assetListFilters,
  assetCatalogItems,
  depreciationCloseForm,
  trashFilters,
  catalogFilters,
  setAssetStates,
  setMovementReasonCodes,
  setAssetTypes,
  setAssetEstablishments,
  setAssetListEstablishments,
  setAssetDependencies,
  setAssetListDependencies,
  setTransferEstablishments,
  setTransferDependencies,
  setAssetCatalogItems,
  setAssetsLoading,
  setAssetsList,
  setSelectedAssetIds,
  setAssetListTotal,
  setAssetListPage,
  setDepreciationRuns,
  setDepreciationRunsLoading,
  setDepreciationClosing,
  setTrashLoading,
  setTrashAssets,
  setAssetMovements,
  setAssetHistoryLoading,
  setEvidenceForm,
  setAssetEvidence,
  setAssetEvidenceLoading,
  setSelectedCatalogItem,
  setCatalogModalOpen,
  setAssetForm,
}) {
  async function loadAssetStates() {
    const data = await api('/catalog/asset-states?take=100')
    setAssetStates(data.items || [])
  }

  async function loadMovementReasonCodes() {
    const data = await api('/assets/reason-codes')
    setMovementReasonCodes({
      transfer: data.transfer || [],
      statusChange: data.statusChange || [],
      restore: data.restore || [],
    })
  }

  async function loadAssetTypes() {
    const data = await api('/catalog/asset-types?take=100')
    setAssetTypes(data.items || [])
  }

  async function loadAssetEstablishments(institutionId) {
    try {
      const items = await collectPagedCatalog(api, '/catalog/establishments', {
        institutionId: institutionId ? Number(institutionId) : undefined,
      })
      setAssetEstablishments(items)
    } catch (err) {
      setAssetEstablishments([])
      setErr(err?.message || 'No se pudieron cargar establecimientos.')
    }
  }

  async function loadAssetListEstablishments(institutionId) {
    try {
      const items = await collectPagedCatalog(api, '/catalog/establishments', {
        institutionId: institutionId ? Number(institutionId) : undefined,
      })
      setAssetListEstablishments(items)
    } catch (err) {
      setAssetListEstablishments([])
      setErr(err?.message || 'No se pudieron cargar establecimientos.')
    }
  }

  async function loadAssetDependencies(establishmentId) {
    if (!establishmentId) {
      setAssetDependencies([])
      return
    }
    try {
      const items = await collectPagedCatalog(api, '/catalog/dependencies', {
        establishmentId: Number(establishmentId),
      })
      setAssetDependencies(items)
    } catch (err) {
      setAssetDependencies([])
      setErr(err?.message || 'No se pudieron cargar sectores.')
    }
  }

  async function loadAssetListDependencies(establishmentId) {
    if (!establishmentId) {
      setAssetListDependencies([])
      return
    }
    try {
      const items = await collectPagedCatalog(api, '/catalog/dependencies', {
        establishmentId: Number(establishmentId),
      })
      setAssetListDependencies(items)
    } catch (err) {
      setAssetListDependencies([])
      setErr(err?.message || 'No se pudieron cargar sectores.')
    }
  }

  async function loadTransferEstablishmentsForAsset(asset) {
    if (!asset) {
      setTransferEstablishments([])
      return
    }
    const params = new URLSearchParams()
    const institutionId = asset?.establishment?.institutionId
    if (institutionId) params.set('institutionId', String(institutionId))
    params.set('take', '100')
    const data = await api(`/catalog/establishments?${params.toString()}`)
    const options = (data.items || []).filter(
      (establishment) => String(establishment.id) !== String(asset.establishmentId)
    )
    setTransferEstablishments(options)
  }

  async function loadTransferDependenciesForEstablishment(establishmentId) {
    if (!establishmentId) {
      setTransferDependencies([])
      return
    }
    const params = new URLSearchParams()
    params.set('establishmentId', String(establishmentId))
    params.set('take', '100')
    const data = await api(`/catalog/dependencies?${params.toString()}`)
    setTransferDependencies(data.items || [])
  }

  async function loadCatalogItems() {
    const baseParams = new URLSearchParams()
    if (catalogFilters.q) baseParams.set('q', catalogFilters.q)
    if (catalogFilters.category) baseParams.set('category', catalogFilters.category)
    if (catalogFilters.subcategory) baseParams.set('subcategory', catalogFilters.subcategory)
    if (catalogFilters.brand) baseParams.set('brand', catalogFilters.brand)
    if (catalogFilters.modelName) baseParams.set('modelName', catalogFilters.modelName)

    const take = 100
    let skip = 0
    let total = 0
    const collected = []

    do {
      const params = new URLSearchParams(baseParams)
      params.set('take', String(take))
      params.set('skip', String(skip))
      const data = await api(`/catalog/items?${params.toString()}`)
      const items = data.items || []
      total = Number(data.total || 0)
      collected.push(...items)
      skip += take
      if (!items.length) break
    } while (skip < total && collected.length < 10000)

    setAssetCatalogItems(collected)
  }

  async function loadAssetsList(page = assetListPage) {
    setAssetsLoading(true)
    try {
      const safePage = Number(page)
      const normalizedPage = Number.isFinite(safePage) && safePage > 0 ? safePage : 1
      const take = 20
      const skip = (normalizedPage - 1) * take
      const params = new URLSearchParams()
      const safeId = toPositiveIntOrNull(assetListFilters.id)
      if (assetListFilters.id && !safeId) {
        throw new Error('Filtro ID invalido. Usa solo numeros positivos.')
      }
      if (safeId) params.set('id', String(safeId))
      if (assetListFilters.internalCode) {
        params.set('internalCode', assetListFilters.internalCode)
      }
      if (assetListFilters.q) params.set('q', assetListFilters.q)
      if (assetListFilters.responsibleName) {
        params.set('responsibleName', assetListFilters.responsibleName)
      }
      if (assetListFilters.costCenter) params.set('costCenter', assetListFilters.costCenter)
      if (assetListFilters.institutionId) {
        params.set('institutionId', assetListFilters.institutionId)
      }
      if (assetListFilters.establishmentId) {
        params.set('establishmentId', assetListFilters.establishmentId)
      }
      if (assetListFilters.dependencyId) {
        params.set('dependencyId', assetListFilters.dependencyId)
      }
      if (assetListFilters.assetStateId) {
        params.set('assetStateId', assetListFilters.assetStateId)
      }
      if (assetListFilters.includeDeleted) params.set('includeDeleted', 'true')
      if (assetListFilters.fromDate) params.set('fromDate', assetListFilters.fromDate)
      if (assetListFilters.toDate) params.set('toDate', assetListFilters.toDate)
      params.set('take', String(take))
      params.set('skip', String(skip))
      params.set('withCount', 'true')

      const data = await api(`/assets?${params.toString()}`)
      const nextItems = data.items || []
      setAssetsList(nextItems)
      setSelectedAssetIds((prev) =>
        prev.filter((id) => nextItems.some((item) => String(item.id) === String(id)))
      )
      setAssetListTotal(data.total || 0)
      setAssetListPage(normalizedPage)
    } catch (err) {
      setAssetsList([])
      setSelectedAssetIds([])
      setAssetListTotal(0)
      setErr(err)
    } finally {
      setAssetsLoading(false)
    }
  }

  async function loadDepreciationRuns(options = {}) {
    const silent = Boolean(options?.silent)
    if (!isCentral) {
      setDepreciationRuns([])
      return
    }
    setDepreciationRunsLoading(true)
    try {
      const data = await api('/assets/depreciation/runs?take=5')
      setDepreciationRuns(data.items || [])
    } catch (err) {
      setDepreciationRuns([])
      if (!silent) setErr(err, 'No se pudieron cargar los cierres de depreciacion.')
    } finally {
      setDepreciationRunsLoading(false)
    }
  }

  async function loadTrash() {
    setTrashLoading(true)
    try {
      const params = new URLSearchParams()
      if (trashFilters.q) params.set('q', trashFilters.q)
      if (trashFilters.internalCode) params.set('internalCode', trashFilters.internalCode)
      if (trashFilters.deletedFrom) params.set('deletedFrom', trashFilters.deletedFrom)
      if (trashFilters.deletedTo) params.set('deletedTo', trashFilters.deletedTo)
      params.set('includeDeleted', 'true')
      params.set('onlyDeleted', 'true')
      params.set('take', '50')
      params.set('withCount', 'false')
      const data = await api(`/assets?${params.toString()}`)
      setTrashAssets(data.items || [])
    } finally {
      setTrashLoading(false)
    }
  }

  async function loadAssetMovements(assetId) {
    const safeAssetId = toPositiveIntOrNull(assetId)
    if (!safeAssetId) {
      setAssetMovements([])
      setAssetHistoryLoading(false)
      return
    }
    setAssetHistoryLoading(true)
    try {
      const data = await api(`/assets/${safeAssetId}/history`)
      const movements = Array.isArray(data.movements) ? data.movements : []
      setAssetMovements(movements)
      const evidenceCandidates = movements.filter(
        (movement) =>
          movement.type === 'TRANSFER' ||
          movement.type === 'RELOCATION' ||
          movement.type === 'STATUS_CHANGE' ||
          movement.type === 'INVENTORY_CHECK'
      )
      const latestEvidenceMovement =
        evidenceCandidates.length > 0 ? evidenceCandidates[evidenceCandidates.length - 1] : null
      setEvidenceForm((prev) => ({
        ...prev,
        movementId: movements.some((movement) => String(movement.id) === String(prev.movementId))
          ? prev.movementId
          : latestEvidenceMovement?.id
            ? String(latestEvidenceMovement.id)
            : '',
      }))
    } catch {
      setAssetMovements([])
    } finally {
      setAssetHistoryLoading(false)
    }
  }

  async function loadAssetEvidence(assetId) {
    const safeAssetId = toPositiveIntOrNull(assetId)
    if (!safeAssetId) {
      setAssetEvidence([])
      return
    }
    setAssetEvidenceLoading(true)
    try {
      const data = await api(`/assets/${safeAssetId}/evidence?take=100&skip=0`)
      setAssetEvidence(data.items || [])
    } catch (err) {
      setErr(err)
    } finally {
      setAssetEvidenceLoading(false)
    }
  }

  function submitDepreciationClose() {
    const fiscalYear = Number(depreciationCloseForm.fiscalYear)
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2200) {
      setErr('Ingresa un año válido entre 2000 y 2200.')
      return
    }
    if (fiscalYear >= new Date().getFullYear()) {
      setErr(`El año ${fiscalYear} solo se puede cerrar desde el 01-01-${fiscalYear + 1}.`)
      return
    }

    openConfirm({
      title: 'Cerrar depreciacion anual',
      message: `Se generará el cierre al 31-12 del año seleccionado (${fiscalYear}) para la institución actual. ¿Continuar?`,
      onConfirm: async () => {
        setDepreciationClosing(true)
        try {
          const result = await api('/assets/depreciation/runs/close', {
            method: 'POST',
            body: { fiscalYear },
          })
          await loadDepreciationRuns({ silent: true })
          const totalAssets = Number(result?.totalAssets || 0)
          const totalDep = Math.round(
            Number(result?.totalAnnualDepreciation || 0)
          ).toLocaleString('es-CL')
          setOk(
            `Cierre ${result?.fiscalYear || fiscalYear} generado: ${totalAssets} activos y ${totalDep} CLP de depreciacion.`
          )
        } catch (err) {
          setErr(err)
        } finally {
          setDepreciationClosing(false)
          closeConfirm()
        }
      },
    })
  }

  function applyCatalogItem(selected) {
    if (!selected) {
      setErr('No se encontro el catalogo seleccionado.')
      return
    }
    setSelectedCatalogItem(selected)
    setCatalogModalOpen(true)
    setAssetForm((prev) => ({
      ...prev,
      catalogItemId: String(selected.id || ''),
      name: selected.name || '',
      brand: selected.brand || '',
      modelName: selected.modelName || '',
    }))
    void suggestAssetDepreciation(selected)
    setOk(`Catalogo seleccionado: ${formatCatalogItemDisplay(selected)}`)
  }

  function handleSelectCatalogItem(value) {
    if (!value) {
      setSelectedCatalogItem(null)
      setAssetForm((prev) => ({
        ...prev,
        catalogItemId: '',
      }))
      return
    }
    const selected = assetCatalogItems.find((item) => String(item.id) === String(value))
    applyCatalogItem(selected)
  }

  return {
    loadAssetStates,
    loadMovementReasonCodes,
    loadAssetTypes,
    loadAssetEstablishments,
    loadAssetListEstablishments,
    loadAssetDependencies,
    loadAssetListDependencies,
    loadTransferEstablishmentsForAsset,
    loadTransferDependenciesForEstablishment,
    loadCatalogItems,
    loadAssetsList,
    loadDepreciationRuns,
    loadTrash,
    loadAssetMovements,
    loadAssetEvidence,
    submitDepreciationClose,
    applyCatalogItem,
    handleSelectCatalogItem,
  }
}

export default useAssetsAdminData
