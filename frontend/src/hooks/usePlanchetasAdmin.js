import { useEffect, useMemo, useRef, useState } from 'react'

function getPlanchetaErrorMessage(err, fallback) {
  if (err?.code === 'PLANCHETA_INVALID_DATE_FORMAT') {
    const field = err?.details?.field
    if (field === 'fromDate') return 'Fecha "desde" invalida. Usa formato YYYY-MM-DD.'
    if (field === 'toDate') return 'Fecha "hasta" invalida. Usa formato YYYY-MM-DD.'
    return 'Formato de fecha invalido. Usa YYYY-MM-DD.'
  }
  if (err?.code === 'PLANCHETA_INVALID_DATE_RANGE') {
    return 'Rango de fechas invalido: "desde" no puede ser mayor que "hasta".'
  }
  return err?.message || fallback
}

function usePlanchetasAdmin({
  api,
  downloadFile,
  previewFile,
  setErr,
  currentUser,
  tokenClaims,
  isAuthed,
  activeTab,
}) {
  const [planchetaFilters, setPlanchetaFilters] = useState({
    institutionId: '',
    establishmentId: '',
    dependencyId: '',
    responsibleFilterName: '',
    fromDate: '',
    toDate: '',
    responsibleName: 'Encargado de Sector',
    chiefName: 'Jefe de Sector',
    ministryText:
      'Certifico que el presente inventario corresponde a los bienes fisicos verificados en el sector indicado, en conformidad con lineamientos ministeriales vigentes.',
    includeHistory: false,
  })
  const [planchetaInstitutions, setPlanchetaInstitutions] = useState([])
  const [planchetaEstablishments, setPlanchetaEstablishments] = useState([])
  const [planchetaDependencies, setPlanchetaDependencies] = useState([])
  const [planchetaPreview, setPlanchetaPreview] = useState([])
  const [planchetaSummary, setPlanchetaSummary] = useState([])
  const [planchetaDirectory, setPlanchetaDirectory] = useState([])
  const [planchetaInsights, setPlanchetaInsights] = useState(null)
  const [planchetaPreviewLoading, setPlanchetaPreviewLoading] = useState(false)
  const [loadingPlancheta, setLoadingPlancheta] = useState(false)
  const [planchetaMessage, setPlanchetaMessage] = useState('')
  const planchetaInstitutionsPromiseRef = useRef(null)
  const planchetaInstitutionsLoadedRef = useRef(false)

  const planchetaQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (!planchetaFilters.establishmentId) return ''
    params.set('establishmentId', planchetaFilters.establishmentId)
    if (planchetaFilters.dependencyId) params.set('sectorId', planchetaFilters.dependencyId)
    if (planchetaFilters.responsibleFilterName) {
      params.set('responsibleFilterName', planchetaFilters.responsibleFilterName)
    }
    if (planchetaFilters.fromDate) params.set('fromDate', planchetaFilters.fromDate)
    if (planchetaFilters.toDate) params.set('toDate', planchetaFilters.toDate)
    if (planchetaFilters.responsibleName) {
      params.set('responsibleName', planchetaFilters.responsibleName)
    }
    if (planchetaFilters.chiefName) params.set('chiefName', planchetaFilters.chiefName)
    if (planchetaFilters.ministryText) params.set('ministryText', planchetaFilters.ministryText)
    // Requisito operativo: no incluir activos dados de baja en plancheta.
    params.set('includeHistory', 'false')
    return params.toString()
  }, [planchetaFilters])

  const canPreviewPlancheta = Boolean(planchetaQuery) && !planchetaPreviewLoading
  const canExportPlancheta = canPreviewPlancheta && planchetaPreview.length > 0

  async function loadPlanchetaInstitutions(options = {}) {
    const { force = false } = options
    if (!force && planchetaInstitutionsLoadedRef.current) return planchetaInstitutions
    if (!force && planchetaInstitutionsPromiseRef.current) {
      return planchetaInstitutionsPromiseRef.current
    }

    setLoadingPlancheta(true)
    planchetaInstitutionsPromiseRef.current = (async () => {
      try {
        const data = await api('/catalog/institutions?take=100&includeInactive=true')
        const institutions = data.items || []
        setPlanchetaInstitutions(institutions)
        planchetaInstitutionsLoadedRef.current = true
        if (!institutions.length) {
          setPlanchetaMessage(
            'No hay instituciones disponibles. Crea estructura base antes de usar planchetas.'
          )
        } else {
          setPlanchetaMessage('')
          setPlanchetaFilters((prev) => {
            if (prev.institutionId) return prev
            const preferredInstitutionId =
              (currentUser?.institutionId && String(currentUser.institutionId)) ||
              (tokenClaims?.institutionId && String(tokenClaims.institutionId)) ||
              String(institutions[0].id || '')
            if (!preferredInstitutionId) return prev
            return {
              ...prev,
              institutionId: preferredInstitutionId,
            }
          })
        }
        return institutions
      } catch (err) {
        setPlanchetaMessage(err?.message || 'No se pudieron cargar instituciones.')
        setErr(err)
        throw err
      } finally {
        planchetaInstitutionsPromiseRef.current = null
        setLoadingPlancheta(false)
      }
    })()

    return planchetaInstitutionsPromiseRef.current
  }

  async function loadPlanchetaEstablishments(institutionId) {
    if (!institutionId) {
      setPlanchetaEstablishments([])
      return
    }
    try {
      const params = new URLSearchParams()
      params.set('institutionId', String(institutionId))
      params.set('take', '100')
      params.set('includeInactive', 'true')
      const data = await api(`/catalog/establishments?${params.toString()}`)
      const establishments = data.items || []
      setPlanchetaEstablishments(establishments)
      if (!establishments.length) {
        const scopedInstitutionId =
          (currentUser?.institutionId && String(currentUser.institutionId)) ||
          (tokenClaims?.institutionId && String(tokenClaims.institutionId)) ||
          ''
        if (scopedInstitutionId && String(scopedInstitutionId) !== String(institutionId)) {
          setPlanchetaFilters((prev) => ({
            ...prev,
            institutionId: scopedInstitutionId,
            establishmentId: '',
            dependencyId: '',
          }))
          return
        }
        setPlanchetaFilters((prev) => ({
          ...prev,
          establishmentId: '',
          dependencyId: '',
        }))
        setPlanchetaMessage('No hay establecimientos en esta institucion.')
      } else {
        setPlanchetaMessage('')
        setPlanchetaFilters((prev) => {
          if (prev.establishmentId) return prev
          const preferredEstablishmentId =
            (currentUser?.establishmentId && String(currentUser.establishmentId)) ||
            (tokenClaims?.establishmentId && String(tokenClaims.establishmentId)) ||
            String(establishments[0].id || '')
          if (!preferredEstablishmentId) return prev
          return {
            ...prev,
            establishmentId: preferredEstablishmentId,
          }
        })
      }
    } catch (err) {
      setPlanchetaEstablishments([])
      setPlanchetaMessage(err?.message || 'No se pudieron cargar establecimientos.')
      setErr(err?.message || 'No se pudieron cargar establecimientos.')
    }
  }

  async function loadPlanchetaDependencies(establishmentId) {
    if (!establishmentId) {
      setPlanchetaDependencies([])
      return
    }
    try {
      const params = new URLSearchParams()
      params.set('establishmentId', String(establishmentId))
      params.set('take', '100')
      const data = await api(`/catalog/dependencies?${params.toString()}`)
      const items = data.items || []
      setPlanchetaDependencies(items)
      if (!items.length) {
        setPlanchetaMessage('No hay sectores en este establecimiento.')
      } else if (planchetaMessage === 'No hay sectores en este establecimiento.') {
        setPlanchetaMessage('')
      }
    } catch (err) {
      setPlanchetaDependencies([])
      setErr(err?.message || 'No se pudieron cargar sectores.')
    }
  }

  async function loadPlanchetaPreview() {
    if (!planchetaQuery) {
      setPlanchetaMessage('Selecciona establecimiento para previsualizar.')
      setPlanchetaPreview([])
      setPlanchetaSummary([])
      setPlanchetaDirectory([])
      setPlanchetaInsights(null)
      return
    }
    setPlanchetaPreviewLoading(true)
    try {
      const data = await api(`/planchetas?${planchetaQuery}`)
      const items = data.items || []
      const summary = data.summary || []
      const directory = data.directory || []
      const insights = data.insights || null
      setPlanchetaPreview(items)
      setPlanchetaSummary(summary)
      setPlanchetaDirectory(directory)
      setPlanchetaInsights(insights)
      if (!items.length) {
        setPlanchetaMessage(
          'No hay activos fijos para ese filtro. Carga activos fijos en el sector y vuelve a intentar.'
        )
      } else {
        setPlanchetaMessage('')
      }
    } catch (err) {
      setPlanchetaPreview([])
      setPlanchetaSummary([])
      setPlanchetaDirectory([])
      setPlanchetaInsights(null)
      const message = getPlanchetaErrorMessage(err, 'No se pudo cargar la previsualizacion.')
      setPlanchetaMessage(message)
      setErr(message)
    } finally {
      setPlanchetaPreviewLoading(false)
    }
  }

  function formatPlanchetaMovement(movement) {
    const typeMap = {
      INVENTORY_CHECK: 'Registro inicial',
      TRANSFER: 'Transferencia',
      STATUS_CHANGE: 'Cambio de estado',
      RELOCATION: 'Reubicacion',
    }
    const typeLabel = typeMap[movement?.type] || movement?.type || 'Movimiento'
    const reason = movement?.reasonCode || movement?.reason || 'sin motivo'
    return `${typeLabel} (${reason})`
  }

  function buildPlanchetaExportTarget(kind, variant = 'formal') {
    const isExecutive = variant === 'gerencial'
    const isDirectory = variant === 'directorio'
    const isCompact = variant === 'compacta'
    const basePath = isExecutive
      ? '/planchetas/gerencial'
      : isCompact
        ? '/planchetas/compacta'
        : isDirectory
          ? '/planchetas/directorio'
          : '/planchetas'
    const path = kind === 'excel' ? `${basePath}/excel?${planchetaQuery}` : `${basePath}/pdf?${planchetaQuery}`
    const filename =
      kind === 'excel'
        ? isExecutive
          ? 'plancheta_gerencial.xlsx'
          : isCompact
            ? 'plancheta_compacta.xlsx'
            : isDirectory
              ? 'plancheta_directorio.xlsx'
              : 'plancheta.xlsx'
        : isExecutive
          ? 'plancheta_gerencial.pdf'
          : isCompact
            ? 'plancheta_compacta.pdf'
            : isDirectory
              ? 'plancheta_directorio.pdf'
              : 'plancheta.pdf'
    return { path, filename }
  }

  async function downloadPlancheta(kind, variant = 'formal') {
    if (!planchetaQuery) {
      const message = 'Selecciona establecimiento para descargar plancheta.'
      setPlanchetaMessage(message)
      setErr(message)
      return
    }
    const { path, filename } = buildPlanchetaExportTarget(kind, variant)
    try {
      await downloadFile(path, filename)
    } catch (err) {
      const message = getPlanchetaErrorMessage(
        err,
        `No se pudo descargar plancheta ${kind.toUpperCase()}.`
      )
      setPlanchetaMessage(message)
      setErr(err, message)
    }
  }

  async function previewPlancheta(kind, variant = 'formal') {
    if (!planchetaQuery) {
      const message = 'Selecciona establecimiento para previsualizar plancheta.'
      setPlanchetaMessage(message)
      setErr(message)
      return
    }
    if (typeof previewFile !== 'function') {
      const message = 'No se pudo iniciar la previsualizacion en este entorno.'
      setPlanchetaMessage(message)
      setErr(message)
      return
    }
    const { path, filename } = buildPlanchetaExportTarget(kind, variant)
    try {
      await previewFile(path, filename)
    } catch (err) {
      const message = getPlanchetaErrorMessage(
        err,
        `No se pudo previsualizar plancheta ${kind.toUpperCase()}.`
      )
      setPlanchetaMessage(message)
      setErr(err, message)
    }
  }

  useEffect(() => {
    if (!isAuthed || activeTab !== 'planchetas') return
    loadPlanchetaInstitutions()
  }, [isAuthed, activeTab])

  useEffect(() => {
    if (!isAuthed || activeTab !== 'planchetas') return
    if (!planchetaFilters.institutionId) {
      setPlanchetaEstablishments([])
      return
    }
    loadPlanchetaEstablishments(planchetaFilters.institutionId)
  }, [isAuthed, activeTab, planchetaFilters.institutionId])

  useEffect(() => {
    if (!isAuthed || activeTab !== 'planchetas') return
    if (!planchetaFilters.establishmentId) {
      setPlanchetaDependencies([])
      return
    }
    loadPlanchetaDependencies(planchetaFilters.establishmentId)
  }, [isAuthed, activeTab, planchetaFilters.establishmentId])

  useEffect(() => {
    if (activeTab !== 'planchetas') return
    setPlanchetaPreview([])
    setPlanchetaSummary([])
    setPlanchetaDirectory([])
    setPlanchetaInsights(null)
  }, [
    activeTab,
    planchetaFilters.institutionId,
    planchetaFilters.establishmentId,
    planchetaFilters.dependencyId,
    planchetaFilters.responsibleFilterName,
    planchetaFilters.fromDate,
    planchetaFilters.toDate,
    planchetaFilters.includeHistory,
  ])

  return {
    planchetaFilters,
    setPlanchetaFilters,
    planchetaInstitutions,
    planchetaEstablishments,
    setPlanchetaEstablishments,
    planchetaDependencies,
    setPlanchetaDependencies,
    planchetaPreview,
    planchetaSummary,
    planchetaDirectory,
    planchetaInsights,
    planchetaPreviewLoading,
    loadingPlancheta,
    planchetaMessage,
    planchetaQuery,
    canPreviewPlancheta,
    canExportPlancheta,
    loadPlanchetaEstablishments,
    loadPlanchetaDependencies,
    loadPlanchetaPreview,
    downloadPlancheta,
    previewPlancheta,
    formatPlanchetaMovement,
  }
}

export default usePlanchetasAdmin
