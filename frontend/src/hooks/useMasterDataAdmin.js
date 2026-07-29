import { useRef, useState } from 'react'
import { UI_ERROR, UI_STATUS, UI_SUCCESS } from '../constants/uiMessages'

function uniqueById(items) {
  return Array.from(new Map((items || []).map((item) => [item.id, item])).values())
}

function useMasterDataAdmin({
  api,
  setErr,
  setOk,
  setFormErrors,
  openConfirm,
  closeConfirm,
  openDeleteBlockModal,
  openForceDelete,
  dangerZoneUnlocked,
  withMappedError,
  getInstitutionConflictMessage,
  getEstablishmentConflictMessage,
  getDependencyConflictMessage,
}) {
  const [institutions, setInstitutions] = useState([])
  const [institutionsCatalog, setInstitutionsCatalog] = useState([])
  const [loadingInstitutions, setLoadingInstitutions] = useState(false)
  const [instQuery, setInstQuery] = useState('')
  const [instForm, setInstForm] = useState({ name: '' })
  const [instPage, setInstPage] = useState(1)
  const [instTotal, setInstTotal] = useState(0)
  const [instOriginal, setInstOriginal] = useState({})
  const [instSort, setInstSort] = useState({ key: 'name', order: 'asc' })
  const [instIncludeInactive, setInstIncludeInactive] = useState(true)

  const [establishments, setEstablishments] = useState([])
  const [establishmentsCatalog, setEstablishmentsCatalog] = useState([])
  const [loadingEstablishments, setLoadingEstablishments] = useState(false)
  const [estFilters, setEstFilters] = useState({
    q: '',
    institutionId: '',
    institutionSearch: '',
  })
  const [estForm, setEstForm] = useState({
    name: '',
    type: '',
    rbd: '',
    commune: '',
    institutionId: '',
  })
  const [estPage, setEstPage] = useState(1)
  const [estTotal, setEstTotal] = useState(0)
  const [estOriginal, setEstOriginal] = useState({})
  const [estSort, setEstSort] = useState({ key: 'name', order: 'asc' })
  const [estIncludeInactive, setEstIncludeInactive] = useState(true)

  const [dependencies, setDependencies] = useState([])
  const [dependenciesCatalog, setDependenciesCatalog] = useState([])
  const [loadingDependencies, setLoadingDependencies] = useState(false)
  const [depFilters, setDepFilters] = useState({
    q: '',
    establishmentId: '',
    establishmentSearch: '',
  })
  const [depForm, setDepForm] = useState({ name: '', establishmentId: '' })
  const [depReplicateForm, setDepReplicateForm] = useState({
    sourceEstablishmentId: '',
    targetEstablishmentId: '',
    includeInactive: false,
  })
  const [depReplicateResult, setDepReplicateResult] = useState(null)
  const [depPage, setDepPage] = useState(1)
  const [depTotal, setDepTotal] = useState(0)
  const [depOriginal, setDepOriginal] = useState({})
  const [depSort, setDepSort] = useState({ key: 'name', order: 'asc' })
  const [depIncludeInactive, setDepIncludeInactive] = useState(true)
  const institutionCatalogPromiseRef = useRef(null)
  const institutionCatalogLoadedRef = useRef(false)

  async function loadInstitutions(page = instPage) {
    const take = 10
    const skip = (page - 1) * take
    const params = new URLSearchParams()
    if (instQuery) params.set('q', instQuery)
    if (instIncludeInactive) params.set('includeInactive', 'true')
    params.set('take', String(take))
    params.set('skip', String(skip))
    const data = await api(`/admin/institutions?${params.toString()}`)
    setInstitutions(data.items || [])
    setInstTotal(data.total || 0)
    const snapshot = {}
    ;(data.items || []).forEach((item) => {
      snapshot[item.id] = { name: item.name }
    })
    setInstOriginal(snapshot)
  }

  async function loadInstitutionCatalog(options = {}) {
    const { force = false } = options
    if (!force && institutionCatalogLoadedRef.current) return institutionsCatalog
    if (!force && institutionCatalogPromiseRef.current) return institutionCatalogPromiseRef.current

    setLoadingInstitutions(true)
    institutionCatalogPromiseRef.current = (async () => {
      try {
        const take = 100
        let skip = 0
        let total = 0
        const collected = []
        do {
          const params = new URLSearchParams()
          params.set('take', String(take))
          params.set('skip', String(skip))
          params.set('includeInactive', 'true')
          const data = await api(`/catalog/institutions?${params.toString()}`)
          const items = data.items || []
          total = Number(data.total || 0)
          collected.push(...items)
          skip += take
          if (!items.length) break
        } while (skip < total && collected.length < 10000)
        const nextCatalog = uniqueById(collected)
        setInstitutionsCatalog(nextCatalog)
        institutionCatalogLoadedRef.current = true
        return nextCatalog
      } finally {
        institutionCatalogPromiseRef.current = null
        setLoadingInstitutions(false)
      }
    })()

    return institutionCatalogPromiseRef.current
  }

  async function loadEstablishments(page = estPage) {
    const take = 10
    const skip = (page - 1) * take
    const params = new URLSearchParams()
    if (estFilters.q) params.set('q', estFilters.q)
    if (estFilters.institutionId) params.set('institutionId', estFilters.institutionId)
    if (estIncludeInactive) params.set('includeInactive', 'true')
    params.set('take', String(take))
    params.set('skip', String(skip))
    const data = await api(`/admin/establishments?${params.toString()}`)
    setEstablishments(data.items || [])
    setEstTotal(data.total || 0)
    const snapshot = {}
    ;(data.items || []).forEach((item) => {
      snapshot[item.id] = {
        name: item.name,
        type: item.type,
        rbd: item.rbd || '',
        commune: item.commune || '',
        institutionId: item.institutionId,
      }
    })
    setEstOriginal(snapshot)
  }

  async function loadEstablishmentCatalog(institutionId) {
    setLoadingEstablishments(true)
    try {
      const take = 100
      let skip = 0
      let total = 0
      const collected = []
      do {
        const params = new URLSearchParams()
        if (institutionId) {
          const instId = Number(institutionId)
          if (!Number.isNaN(instId)) params.set('institutionId', String(instId))
        }
        params.set('take', String(take))
        params.set('skip', String(skip))
        if (estIncludeInactive) params.set('includeInactive', 'true')
        const data = await api(`/catalog/establishments?${params.toString()}`)
        const items = data.items || []
        total = Number(data.total || 0)
        collected.push(...items)
        skip += take
        if (!items.length) break
      } while (skip < total && collected.length < 10000)
      setEstablishmentsCatalog(uniqueById(collected))
    } finally {
      setLoadingEstablishments(false)
    }
  }

  async function loadDependencies(page = depPage) {
    const take = 10
    const skip = (page - 1) * take
    const params = new URLSearchParams()
    if (depFilters.q) params.set('q', depFilters.q)
    if (depFilters.establishmentId) params.set('establishmentId', depFilters.establishmentId)
    if (depIncludeInactive) params.set('includeInactive', 'true')
    params.set('take', String(take))
    params.set('skip', String(skip))
    const data = await api(`/admin/dependencies?${params.toString()}`)
    setDependencies(data.items || [])
    setDepTotal(data.total || 0)
    const snapshot = {}
    ;(data.items || []).forEach((item) => {
      snapshot[item.id] = { name: item.name, establishmentId: item.establishmentId }
    })
    setDepOriginal(snapshot)
  }

  async function loadDependencyCatalog(establishmentId) {
    setLoadingDependencies(true)
    try {
      const take = 100
      let skip = 0
      let total = 0
      const collected = []
      do {
        const params = new URLSearchParams()
        if (establishmentId) {
          const estId = Number(establishmentId)
          if (!Number.isNaN(estId)) params.set('establishmentId', String(estId))
        }
        params.set('take', String(take))
        params.set('skip', String(skip))
        if (depIncludeInactive) params.set('includeInactive', 'true')
        const data = await api(`/catalog/dependencies?${params.toString()}`)
        const items = data.items || []
        total = Number(data.total || 0)
        collected.push(...items)
        skip += take
        if (!items.length) break
      } while (skip < total && collected.length < 10000)
      setDependenciesCatalog(uniqueById(collected))
    } finally {
      setLoadingDependencies(false)
    }
  }

  async function createInstitution() {
    try {
      if (!dangerZoneUnlocked) {
        setErr('Acciones críticas bloqueadas. Usa "Habilitar acciones críticas".')
        return
      }
      if (!instForm.name.trim()) {
        setFormErrors((prev) => ({ ...prev, instName: 'Nombre requerido.' }))
        return
      }
      const created = await api('/admin/institutions', {
        method: 'POST',
        body: { name: instForm.name.trim() },
      })
      setInstForm({ name: '' })
      await Promise.all([loadInstitutions(), loadInstitutionCatalog({ force: true })])
      setOk(UI_SUCCESS.institutionCreated(created.name))
    } catch (err) {
      if (err?.status === 403) {
        setErr('Tu sesión no tiene permisos ADMIN_CENTRAL. Cierra sesión y vuelve a ingresar.')
        return
      }
      setErr(err)
    }
  }

  async function updateInstitution(payload) {
    try {
      if (!payload.name || !payload.name.trim()) {
        setFormErrors((prev) => ({ ...prev, instEdit: 'Nombre requerido.' }))
        return
      }
      await api(`/admin/institutions/${payload.id}`, {
        method: 'PUT',
        body: { name: payload.name },
      })
      await loadInstitutions()
      setOk(UI_STATUS.institutionUpdated)
    } catch (err) {
      setErr(err)
    }
  }

  async function deleteInstitution(id) {
    openConfirm({
      title: 'Dar de baja institucion',
      message: 'La institucion quedara inactiva y ya no podra operar hasta su reactivacion.',
      onConfirm: async () => {
        try {
          await api(`/admin/institutions/${id}`, { method: 'DELETE' })
          await loadInstitutions()
          setOk(UI_STATUS.institutionDeactivated)
        } catch (err) {
          const message = getInstitutionConflictMessage(
            err,
            UI_ERROR.couldNotDeactivate('la institucion')
          )
          setErr(withMappedError(err, message, UI_ERROR.couldNotDeactivate('la institucion')))
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function reactivateInstitution(id) {
    try {
      await api(`/admin/institutions/${id}/reactivate`, { method: 'PUT' })
      await Promise.all([loadInstitutions(), loadInstitutionCatalog({ force: true })])
      setOk(UI_STATUS.institutionReactivated)
    } catch (err) {
      const message = getInstitutionConflictMessage(
        err,
        UI_ERROR.couldNotReactivate('la institucion')
      )
      setErr(withMappedError(err, message, UI_ERROR.couldNotReactivate('la institucion')))
    }
  }

  async function hardDeleteInstitution(id) {
    openConfirm({
      title: 'Eliminar institucion',
      message: 'Esta accion es irreversible. Se eliminara definitivamente si no tiene relaciones.',
      onConfirm: async () => {
        try {
          await api(`/admin/institutions/${id}/permanent`, { method: 'DELETE' })
          await loadInstitutions()
          setOk(UI_STATUS.institutionDeleted)
        } catch (err) {
          if (err?.code === 'INSTITUTION_HARD_DELETE_HAS_RELATIONS') {
            openForceDelete('institution', id, `#${id}`)
            setOk('La institucion tiene relaciones. Usa eliminacion forzada confirmada.')
            return
          }
          const message = getInstitutionConflictMessage(
            err,
            UI_ERROR.couldNotDeletePermanently('la institucion')
          )
          setErr(
            withMappedError(
              err,
              message,
              UI_ERROR.couldNotDeletePermanently('la institucion')
            )
          )
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function createEstablishment() {
    try {
      if (!estForm.name.trim()) {
        setFormErrors((prev) => ({ ...prev, estName: 'Nombre requerido.' }))
        return
      }
      if (!estForm.type.trim()) {
        setFormErrors((prev) => ({ ...prev, estType: 'Tipo requerido.' }))
        return
      }
      if (!Number(estForm.institutionId)) {
        setFormErrors((prev) => ({
          ...prev,
          estInstitutionId: 'ID de institucion invalido.',
        }))
        return
      }
      const created = await api('/admin/establishments', {
        method: 'POST',
        body: {
          name: estForm.name,
          type: estForm.type,
          ...(estForm.rbd ? { rbd: estForm.rbd.trim() } : {}),
          ...(estForm.commune ? { commune: estForm.commune.trim() } : {}),
          institutionId: Number(estForm.institutionId),
        },
      })
      const createdInstitutionId = Number(estForm.institutionId)
      setEstForm({ name: '', type: '', rbd: '', commune: '', institutionId: '' })
      await Promise.all([
        loadEstablishments(),
        loadEstablishmentCatalog(createdInstitutionId),
        loadInstitutionCatalog(),
      ])
      setOk(UI_SUCCESS.establishmentCreated(created.name))
    } catch (err) {
      setErr(err)
    }
  }

  async function updateEstablishment(payload) {
    try {
      if (payload.name !== undefined && payload.name !== '' && !payload.name.trim()) {
        setFormErrors((prev) => ({ ...prev, estEdit: 'Nombre invalido.' }))
        return
      }
      await api(`/admin/establishments/${payload.id}`, {
        method: 'PUT',
        body: {
          name: payload.name || undefined,
          type: payload.type || undefined,
          rbd:
            payload.rbd === undefined
              ? undefined
              : String(payload.rbd).trim()
                ? String(payload.rbd).trim()
                : undefined,
          commune:
            payload.commune === undefined
              ? undefined
              : String(payload.commune).trim()
                ? String(payload.commune).trim()
                : undefined,
          institutionId: payload.institutionId ? Number(payload.institutionId) : undefined,
        },
      })
      await loadEstablishments()
      setOk('Establecimiento actualizado.')
    } catch (err) {
      setErr(err)
    }
  }

  async function deleteEstablishment(id) {
    openConfirm({
      title: 'Dar de baja establecimiento',
      message: 'El establecimiento quedara inactivo pero no se eliminara.',
      onConfirm: async () => {
        try {
          const result = await api(`/admin/establishments/${id}`, { method: 'DELETE' })
          await loadEstablishments()
          const autoDeps = Number(result?.autoDeactivatedDependencies || 0)
          if (autoDeps > 0) {
            setOk(`Establecimiento dado de baja. Sectores auto-desactivados: ${autoDeps}.`)
          } else {
            setOk('Establecimiento dado de baja.')
          }
        } catch (err) {
          if (err?.code === 'ESTABLISHMENT_HAS_ACTIVE_DEPENDENCIES') {
            openDeleteBlockModal({
              title: 'No se puede dar de baja el establecimiento',
              summary: {
                activeDependencies: Number(err?.details?.activeDependencies || 0),
              },
              dependencies: err?.details?.blockedDependencies || [],
            })
            return
          }
          const message = getEstablishmentConflictMessage(
            err,
            UI_ERROR.couldNotDeactivate('el establecimiento')
          )
          setErr(
            withMappedError(err, message, UI_ERROR.couldNotDeactivate('el establecimiento'))
          )
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function reactivateEstablishment(id) {
    try {
      await api(`/admin/establishments/${id}/reactivate`, { method: 'PUT' })
      await loadEstablishments()
      setOk('Establecimiento reactivado.')
    } catch (err) {
      const message = getEstablishmentConflictMessage(
        err,
        UI_ERROR.couldNotReactivate('el establecimiento')
      )
      setErr(withMappedError(err, message, UI_ERROR.couldNotReactivate('el establecimiento')))
    }
  }

  async function hardDeleteEstablishment(id) {
    openConfirm({
      title: 'Eliminar establecimiento definitivamente',
      message: 'Esta accion es irreversible. Se eliminara definitivamente si no tiene relaciones.',
      onConfirm: async () => {
        try {
          await api(`/admin/establishments/${id}/permanent`, { method: 'DELETE' })
          await loadEstablishments()
          setOk('Establecimiento eliminado definitivamente.')
        } catch (err) {
          if (err?.code === 'ESTABLISHMENT_HARD_DELETE_HAS_RELATIONS') {
            openForceDelete('establishment', id, `#${id}`)
            setOk('El establecimiento tiene relaciones. Usa eliminacion forzada confirmada.')
            return
          }
          const message = getEstablishmentConflictMessage(
            err,
            UI_ERROR.couldNotDeletePermanently('el establecimiento')
          )
          setErr(
            withMappedError(
              err,
              message,
              UI_ERROR.couldNotDeletePermanently('el establecimiento')
            )
          )
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function createDependency() {
    try {
      if (!depForm.name.trim()) {
        setFormErrors((prev) => ({ ...prev, depName: 'Nombre requerido.' }))
        return
      }
      if (!Number(depForm.establishmentId)) {
        setFormErrors((prev) => ({
          ...prev,
          depEstablishmentId: 'ID de establecimiento invalido.',
        }))
        return
      }
      const created = await api('/admin/dependencies', {
        method: 'POST',
        body: {
          name: depForm.name,
          establishmentId: Number(depForm.establishmentId),
        },
      })
      const createdEstablishmentId = Number(depForm.establishmentId)
      setDepForm({ name: '', establishmentId: '' })
      await Promise.all([
        loadDependencies(),
        loadDependencyCatalog(createdEstablishmentId),
        loadEstablishmentCatalog(),
      ])
      setOk(UI_SUCCESS.dependencyCreated(created.name))
    } catch (err) {
      setErr(err)
    }
  }

  async function updateDependency(payload) {
    try {
      if (payload.name !== undefined && payload.name !== '' && !payload.name.trim()) {
        setFormErrors((prev) => ({ ...prev, depEdit: 'Nombre invalido.' }))
        return
      }
      await api(`/admin/dependencies/${payload.id}`, {
        method: 'PUT',
        body: {
          name: payload.name || undefined,
          establishmentId: payload.establishmentId ? Number(payload.establishmentId) : undefined,
        },
      })
      await loadDependencies()
      setOk(UI_STATUS.dependencyUpdated)
    } catch (err) {
      setErr(err)
    }
  }

  async function deleteDependency(id) {
    openConfirm({
      title: 'Dar de baja sector',
      message: 'El sector quedara inactivo pero no se eliminara.',
      onConfirm: async () => {
        try {
          await api(`/admin/dependencies/${id}`, { method: 'DELETE' })
          await loadDependencies()
          setOk(UI_STATUS.dependencyDeactivated)
        } catch (err) {
          const message = getDependencyConflictMessage(
            err,
            UI_ERROR.couldNotDeactivate('el sector')
          )
          setErr(withMappedError(err, message, UI_ERROR.couldNotDeactivate('el sector')))
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function replicateDependenciesFromBase() {
    try {
      setDepReplicateResult(null)
      const sourceEstablishmentId = Number(depReplicateForm.sourceEstablishmentId)
      const targetEstablishmentId = Number(depReplicateForm.targetEstablishmentId)
      if (!sourceEstablishmentId || sourceEstablishmentId <= 0) {
        setErr('Selecciona un establecimiento de origen valido.')
        return
      }
      if (!targetEstablishmentId || targetEstablishmentId <= 0) {
        setErr('Selecciona un establecimiento de destino valido.')
        return
      }
      if (sourceEstablishmentId === targetEstablishmentId) {
        setErr('Origen y destino deben ser distintos.')
        return
      }

      const result = await api('/admin/dependencies/replicate', {
        method: 'POST',
        body: {
          sourceEstablishmentId,
          targetEstablishmentId,
          includeInactive: depReplicateForm.includeInactive,
        },
      })
      await loadDependencies(1)
      const createdCount = Number(result?.createdCount || 0)
      const skippedCount = Number(result?.skippedCount || 0)
      setDepReplicateResult({
        sourceEstablishmentName: result?.sourceEstablishmentName || '-',
        targetEstablishmentName: result?.targetEstablishmentName || '-',
        sourceCount: Number(result?.sourceCount || 0),
        createdCount,
        skippedCount,
        skipped: Array.isArray(result?.skipped) ? result.skipped : [],
      })
      setOk(`Replicacion completada. Creadas: ${createdCount}. Omitidas: ${skippedCount}.`)
    } catch (err) {
      setDepReplicateResult(null)
      setErr(err)
    }
  }

  async function reactivateDependency(id) {
    try {
      await api(`/admin/dependencies/${id}/reactivate`, { method: 'PUT' })
      await loadDependencies()
      setOk(UI_STATUS.dependencyReactivated)
    } catch (err) {
      const message = getDependencyConflictMessage(
        err,
        UI_ERROR.couldNotReactivate('el sector')
      )
      setErr(withMappedError(err, message, UI_ERROR.couldNotReactivate('el sector')))
    }
  }

  async function hardDeleteDependency(id) {
    openConfirm({
      title: 'Eliminar sector definitivamente',
      message: 'Esta accion es irreversible. Se eliminara definitivamente si no tiene relaciones.',
      onConfirm: async () => {
        try {
          await api(`/admin/dependencies/${id}/permanent`, { method: 'DELETE' })
          await loadDependencies()
          setOk(UI_STATUS.dependencyDeleted)
        } catch (err) {
          if (err?.code === 'DEPENDENCY_HARD_DELETE_HAS_RELATIONS') {
            openForceDelete('dependency', id, `#${id}`)
            setOk('El sector tiene relaciones. Usa eliminacion forzada confirmada.')
            return
          }
          const message = getDependencyConflictMessage(
            err,
            UI_ERROR.couldNotDeletePermanently('el sector')
          )
          setErr(
            withMappedError(err, message, UI_ERROR.couldNotDeletePermanently('el sector'))
          )
        } finally {
          closeConfirm()
        }
      },
    })
  }

  return {
    institutions,
    setInstitutions,
    institutionsCatalog,
    loadingInstitutions,
    instQuery,
    setInstQuery,
    instForm,
    setInstForm,
    instPage,
    setInstPage,
    instTotal,
    instOriginal,
    instSort,
    setInstSort,
    instIncludeInactive,
    setInstIncludeInactive,
    establishments,
    setEstablishments,
    establishmentsCatalog,
    loadingEstablishments,
    estFilters,
    setEstFilters,
    estForm,
    setEstForm,
    estPage,
    setEstPage,
    estTotal,
    estOriginal,
    estSort,
    setEstSort,
    estIncludeInactive,
    setEstIncludeInactive,
    dependencies,
    setDependencies,
    dependenciesCatalog,
    setDependenciesCatalog,
    depFilters,
    setDepFilters,
    depForm,
    setDepForm,
    depReplicateForm,
    setDepReplicateForm,
    depReplicateResult,
    depPage,
    setDepPage,
    depTotal,
    depOriginal,
    depSort,
    setDepSort,
    depIncludeInactive,
    setDepIncludeInactive,
    loadInstitutions,
    loadInstitutionCatalog,
    loadEstablishments,
    loadEstablishmentCatalog,
    loadDependencies,
    loadDependencyCatalog,
    createInstitution,
    updateInstitution,
    deleteInstitution,
    reactivateInstitution,
    hardDeleteInstitution,
    createEstablishment,
    updateEstablishment,
    deleteEstablishment,
    reactivateEstablishment,
    hardDeleteEstablishment,
    createDependency,
    updateDependency,
    deleteDependency,
    replicateDependenciesFromBase,
    reactivateDependency,
    hardDeleteDependency,
  }
}

export default useMasterDataAdmin
