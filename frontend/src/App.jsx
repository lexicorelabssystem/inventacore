import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import logoSubsecretaria from './assets/images/logodelgob.png'
import {
  AssetsTabPanel,
  TrashTabPanel,
  ImportsTabPanel,
  PlanchetasTabPanel,
  AuditTabPanel,
} from './components/tabPanels'
import PlanchetasSection from './components/PlanchetasSection'
import AuditSection from './components/AuditSection'
import ImportsSection from './components/ImportsSection'
import ImportsAssetsView from './components/ImportsAssetsView'
import ImportsCatalogView from './components/ImportsCatalogView'
import ImportsSnView from './components/ImportsSnView'
import AssetsSection from './components/AssetsSection'
import AssetsCreateView from './components/AssetsCreateView'
import AssetsListView from './components/AssetsListView'
import AssetCatalogModal from './components/AssetCatalogModal'
import InstitutionsAdminSection from './components/InstitutionsAdminSection'
import EstablishmentsAdminSection from './components/EstablishmentsAdminSection'
import DependenciesAdminSection from './components/DependenciesAdminSection'
import UsersAdminSection from './components/UsersAdminSection'
import AssistantCentralSection from './components/AssistantCentralSection'
import DepreciationCloseView from './components/DepreciationCloseView'
import useMasterDataAdmin from './hooks/useMasterDataAdmin'
import useUsersAdmin from './hooks/useUsersAdmin'
import useAssistantCentral from './hooks/useAssistantCentral'
import useSessionAdmin from './hooks/useSessionAdmin'
import useAssetsDomainState from './hooks/useAssetsDomainState'
import useAssetsAdminData from './hooks/useAssetsAdminData'
import useAssetsAdminActions from './hooks/useAssetsAdminActions'
import useAssetLabelsAndScan from './hooks/useAssetLabelsAndScan'
import useImportsAdmin from './hooks/useImportsAdmin'
import usePlanchetasAdmin from './hooks/usePlanchetasAdmin'
import useAuditAdmin from './hooks/useAuditAdmin'
import { UI_TEXT } from './constants/uiText'
import { UI_ERROR, UI_STATUS } from './constants/uiMessages'
import './App.css'

let xlsxLibPromise
let qrCodeLibPromise
let jsBarcodeLibPromise
let jsPdfLibPromise
let html2CanvasLibPromise

async function loadXlsxLib() {
  if (!xlsxLibPromise) xlsxLibPromise = import('xlsx')
  return xlsxLibPromise
}

async function loadQrCodeLib() {
  if (!qrCodeLibPromise) qrCodeLibPromise = import('qrcode')
  return qrCodeLibPromise
}

async function loadJsBarcodeLib() {
  if (!jsBarcodeLibPromise) jsBarcodeLibPromise = import('jsbarcode')
  return jsBarcodeLibPromise
}

async function loadJsPdfLib() {
  if (!jsPdfLibPromise) jsPdfLibPromise = import('jspdf')
  return jsPdfLibPromise
}

async function loadHtml2CanvasLib() {
  if (!html2CanvasLibPromise) html2CanvasLibPromise = import('html2canvas')
  return html2CanvasLibPromise
}

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE || '/api'
  const PUBLIC_SHEET_BASE = import.meta.env.VITE_PUBLIC_SHEET_BASE || ''
  const INTRO_VIDEO_SRC = import.meta.env.VITE_INTRO_VIDEO_SRC || '/intro.mp4'
  const STORAGE_KEY = 'admin_panel_prefs'
  const CATALOG_ADMIN_TAKE = 20
  const MAX_TAKE = 100
  const IMPORT_REQUIRED_GROUPS = [
    { label: 'Establecimiento', keys: ['establishmentId', 'Establecimiento'] },
    { label: 'Sector', keys: ['dependencyId', 'Sector'] },
    { label: 'Estado', keys: ['assetStateId', 'Estado'] },
    { label: 'Tipo', keys: ['assetTypeId', 'Tipo'] },
    { label: 'Nombre', keys: ['Nombre'] },
    { label: 'Cuenta Contable', keys: ['Cuenta Contable'] },
    { label: 'Analitico', keys: ['Analitico', 'Anal\u00edtico'] },
    { label: 'Valor Adquisicion', keys: ['Valor Adquisicion', 'Valor Adquisici\u00f3n'] },
    { label: 'Fecha Adquisicion', keys: ['Fecha Adquisicion', 'Fecha Adquisici\u00f3n'] },
  ]
  const IMPORT_PLACEHOLDER_VALUES = new Set([
    's/i',
    'si',
    'n/a',
    'na',
    'por informar',
    'por asignar',
    'sin informacion',
    'sin info',
    'no informa',
    'no informado',
  ])
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '')
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem('admin_user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  const [status, setStatus] = useState({
    type: 'idle',
    message: '',
    code: null,
    requestId: null,
    details: null,
  })
  const [statusCopyFeedback, setStatusCopyFeedback] = useState('')
  const DANGER_ZONE_UNLOCK_PASSWORD = String(
    import.meta.env.VITE_DANGER_ZONE_UNLOCK_PASSWORD || ''
  ).trim()
  const introVideoRef = useRef(null)
  const userMenuRef = useRef(null)
  const [formErrors, setFormErrors] = useState({})
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  })
  const [forceDeleteState, setForceDeleteState] = useState({
    open: false,
    entityType: '',
    entityId: null,
    entityLabel: '',
    summary: null,
    details: null,
    confirmationText: '',
    expectedConfirmationText: 'ELIMINAR DEFINITIVO',
    loading: false,
    deleting: false,
  })
  const [deleteBlockState, setDeleteBlockState] = useState({
    open: false,
    title: '',
    summary: null,
    dependencies: [],
  })
  const [activeTab, setActiveTab] = useState('institutions')
  const [importsView, setImportsView] = useState('assets')

  const {
    login,
    setLogin,
    showIntro,
    closeIntro,
    isLoginLoading,
    loginErrorModal,
    setLoginErrorModal,
    isUserMenuOpen,
    isChangePasswordOpen,
    isChangingPassword,
    dangerZoneUnlocked,
    dangerZoneUnlocking,
    dangerZoneUnlockModalOpen,
    dangerZoneUnlockInput,
    setDangerZoneUnlockInput,
    dangerZoneUnlockError,
    setDangerZoneUnlockError,
    changePasswordForm,
    setChangePasswordForm,
    handleLogin,
    handleLogout,
    openChangePassword,
    closeChangePassword,
    toggleUserMenu,
    handleChangePassword,
    unlockDangerZoneButtons,
    closeDangerZoneUnlockModal,
    submitDangerZoneUnlock,
    lockDangerZoneButtons,
  } = useSessionAdmin({
    api,
    setToken,
    setCurrentUser,
    setOk,
    setErr,
    getLoginErrorMessage,
    introVideoRef,
    userMenuRef,
    dangerZoneUnlockPassword: DANGER_ZONE_UNLOCK_PASSWORD,
  })

  const tokenClaims = useMemo(() => {
    if (!token) return null
    try {
      const parts = String(token).split('.')
      if (parts.length < 2) return null
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = `${b64}${'='.repeat((4 - (b64.length % 4)) % 4)}`
      const json = atob(padded)
      return JSON.parse(json)
    } catch {
      return null
    }
  }, [token])
  const isAuthed = useMemo(() => Boolean(token), [token])
  const roleType = useMemo(
    () =>
      currentUser?.role?.type ||
      currentUser?.role ||
      currentUser?.roleType ||
      tokenClaims?.role ||
      '',
    [currentUser, tokenClaims]
  )
  const isCentral = useMemo(() => roleType === 'ADMIN_CENTRAL', [roleType])

  const {
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
  } = useMasterDataAdmin({
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
  })

  const {
    users,
    setUsers,
    usersLoading,
    userInstitutionOptions,
    userEstablishmentOptions,
    usersPage,
    setUsersPage,
    usersTotal,
    usersOriginal,
    userFilters,
    setUserFilters,
    userForm,
    setUserForm,
    userFormPhotoFile,
    setUserFormPhotoFile,
    userFormWithoutPhoto,
    setUserFormWithoutPhoto,
    userPhotoFiles,
    setUserPhotoFiles,
    loadUsersAdmin,
    loadUserAssignmentOptions,
    createUserAdmin,
    saveUserPhotoAdmin,
    clearUserPhotoAdmin,
    updateUserAdmin,
    deactivateUserAdmin,
    reactivateUserAdmin,
    resetUserPasswordAdmin,
  } = useUsersAdmin({
    api,
    apiMultipart,
    setErr,
    setOk,
    openConfirm,
    closeConfirm,
    currentUser,
    setCurrentUser,
    isAuthed,
    isCentral,
    activeTab,
    toPositiveIntOrNull,
  })

  const {
    assistantQuestion,
    setAssistantQuestion,
    assistantNotifyEmail,
    setAssistantNotifyEmail,
    assistantScope,
    setAssistantScope,
    assistantLoading,
    assistantSmtpLoading,
    assistantAnswer,
    supportRequests,
    supportLoading,
    supportPage,
    setSupportPage,
    supportTotal,
    supportFilters,
    setSupportFilters,
    supportCommentDraft,
    setSupportCommentDraft,
    askCentralAssistant,
    createSupportRequestFromAssistant,
    testAssistantSmtp,
    loadSupportRequests,
    updateSupportStatus,
    sendSupportComment,
  } = useAssistantCentral({
    api,
    setErr,
    setOk,
    loadEstablishmentCatalog,
    loadDependencyCatalog,
    setDependenciesCatalog,
    isAuthed,
    isCentral,
    activeTab,
    toPositiveIntOrNull,
  })

  const {
    assetForm,
    setAssetForm,
    assetCatalogItems,
    setAssetCatalogItems,
    showAssetCatalogList,
    setShowAssetCatalogList,
    assetStates,
    setAssetStates,
    assetTypes,
    setAssetTypes,
    assetEstablishments,
    setAssetEstablishments,
    assetDependencies,
    setAssetDependencies,
    assetListEstablishments,
    setAssetListEstablishments,
    assetListDependencies,
    setAssetListDependencies,
    assetInstitutionId,
    setAssetInstitutionId,
    catalogFilters,
    assetCreating,
    setAssetCreating,
    assetHasResponsible,
    setAssetHasResponsible,
    createdAsset,
    setCreatedAsset,
    createdAssetBatch,
    setCreatedAssetBatch,
    assetMultiProductEnabled,
    setAssetMultiProductEnabled,
    assetMultiProductCount,
    setAssetMultiProductCount,
    assetMultiProducts,
    setAssetMultiProducts,
    qrCodeUrl,
    setQrCodeUrl,
    assetErrors,
    setAssetErrors,
    selectedCatalogItem,
    setSelectedCatalogItem,
    catalogModalOpen,
    setCatalogModalOpen,
    catalogAction,
    setCatalogAction,
    editAssetHasResponsible,
    setEditAssetHasResponsible,
    editAssetForm,
    setEditAssetForm,
    moveAssetForm,
    setMoveAssetForm,
    transferAssetForm,
    setTransferAssetForm,
    transferEstablishments,
    setTransferEstablishments,
    transferDependencies,
    setTransferDependencies,
    statusAssetForm,
    setStatusAssetForm,
    movementReasonCodes,
    setMovementReasonCodes,
    assetMovements,
    setAssetMovements,
    assetHistoryLoading,
    setAssetHistoryLoading,
    assetEvidence,
    setAssetEvidence,
    assetEvidenceLoading,
    setAssetEvidenceLoading,
    depreciationCloseForm,
    setDepreciationCloseForm,
    depreciationRuns,
    setDepreciationRuns,
    depreciationRunsLoading,
    setDepreciationRunsLoading,
    depreciationClosing,
    setDepreciationClosing,
    evidenceForm,
    setEvidenceForm,
    assetsList,
    setAssetsList,
    assetsLoading,
    setAssetsLoading,
    labelAssetId,
    setLabelAssetId,
    scanInput,
    setScanInput,
    scanResult,
    setScanResult,
    assetListFilters,
    setAssetListFilters,
    assetListPage,
    setAssetListPage,
    assetListTotal,
    setAssetListTotal,
    selectedAssetIds,
    setSelectedAssetIds,
    trashFilters,
    setTrashFilters,
    trashAssets,
    setTrashAssets,
    trashLoading,
    setTrashLoading,
    restoreModal,
    setRestoreModal,
  } = useAssetsDomainState()

  const refreshTokenPromiseRef = useRef(null)
  const assetSearchDebounceRef = useRef(null)
  const assetsBootstrapPromiseRef = useRef(null)
  const assetsBootstrapLastRunRef = useRef(0)
  const ASSETS_BOOTSTRAP_MIN_INTERVAL_MS = 1500
  const {
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
  } = useAssetsAdminData({
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
  })
  const {
    submitEvidenceUpload,
    prepareEvidenceDocType,
    downloadEvidence,
    getMovementReasonLabel,
    getMovementTitle,
    getMovementRouteLabel,
    isActaEligibleMovement,
    prepareEvidenceForMovement,
    openMovementActa,
    restoreFromTrash,
    confirmRestoreFromTrash,
    handleCreateAsset,
    openCatalogAction,
    selectAssetForModal,
    submitEditAsset,
    submitMoveAsset,
    submitTransferAsset,
    submitStatusAsset,
  } = useAssetsAdminActions({
    api,
    apiMultipart,
    apiText,
    downloadFile,
    setErr,
    setOk,
    isCentral,
    withMappedError,
    getAssetCreateConflictMessage,
    getMoveConflictMessage,
    toPositiveIntOrNull,
    getSafeAssetId,
    validateAssetForm,
    normalizeRutValue,
    normalizeCostCenterValue,
    calculateStraightLineDepreciation,
    loadAssetDependencies,
    loadTransferEstablishmentsForAsset,
    loadAssetStates,
    loadMovementReasonCodes,
    loadAssetsList,
    loadAssetEvidence,
    loadTrash,
    assetForm,
    assetHasResponsible,
    assetMultiProductEnabled,
    assetMultiProducts,
    createdAsset,
    editAssetForm,
    editAssetHasResponsible,
    moveAssetForm,
    transferAssetForm,
    statusAssetForm,
    evidenceForm,
    movementReasonCodes,
    restoreModal,
    assetStates,
    setAssetCreating,
    setAssetErrors,
    setCreatedAsset,
    setCreatedAssetBatch,
    setEditAssetForm,
    setMoveAssetForm,
    setTransferAssetForm,
    setTransferDependencies,
    setStatusAssetForm,
    setEditAssetHasResponsible,
    setEvidenceForm,
    setRestoreModal,
    setSelectedCatalogItem,
    setCatalogModalOpen,
    setCatalogAction,
    setAssetDependencies,
  })

  const {
    importFile,
    setImportFile,
    importLoading,
    setImportLoading,
    importResult,
    setImportResult,
    importErrors,
    setImportErrors,
    importSchemaDetails,
    previewHeaders,
    previewRows,
    previewMissing,
    previewInvalidCells,
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
    handleSnBaseFileChange,
    handleSnBaseImportToCatalog,
    handlePreviewFile,
    handleImportUpload,
    handleCatalogImportUpload,
    handleCatalogManualCreate,
    checkManualOfficialKeyAvailability,
    loadCatalogAdminItems,
    updateCatalogAdminItem,
    scheduleCatalogAdminOfficialKeyValidation,
    discardCatalogAdminItem,
    loadImportHistory,
    loadImportJobStatus,
    resumeImportJob,
  } = useImportsAdmin({
    api,
    setErr,
    setOk,
    activeTab,
    importsView,
    loadXlsxLib,
    apiBase: API_BASE,
    token,
    getCatalogConflictMessage,
    withMappedError,
    catalogAdminTake: CATALOG_ADMIN_TAKE,
    importRequiredGroups: IMPORT_REQUIRED_GROUPS,
    importPlaceholderValues: IMPORT_PLACEHOLDER_VALUES,
  })

  const {
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
    formatPlanchetaMovement,
  } = usePlanchetasAdmin({
    api,
    downloadFile,
    previewFile,
    setErr,
    currentUser,
    tokenClaims,
    isAuthed,
    activeTab,
  })
  const {
    labelData,
    createdLabel,
    downloadLabelPdf,
    openPrintLabel,
    openPrintBatchLabels,
    openPrintBlankBarcodeSequence,
    openPrintAssetListQrLabels,
    openPrintAssetListBarcodeLabels,
    toggleSelectedAsset,
    toggleSelectAllVisibleAssets,
    clearSelectedAssets,
    openPrintSelectedAssetQrLabels,
    openPrintSelectedAssetBarcodeLabels,
    openPrintPlanchetaQrLabels,
    openPrintPlanchetaBarcodeLabels,
    resolveScannedAsset,
    copyTechnicalSheetLink,
  } = useAssetLabelsAndScan({
    api,
    setErr,
    setOk,
    apiBase: API_BASE,
    publicSheetBase: PUBLIC_SHEET_BASE,
    loadQrCodeLib,
    loadJsBarcodeLib,
    loadJsPdfLib,
    loadHtml2CanvasLib,
    toPositiveIntOrNull,
    createdAsset,
    createdAssetBatch,
    qrCodeUrl,
    setQrCodeUrl,
    assetListTotal,
    assetsList,
    assetListFilters,
    selectedAssetIds,
    setSelectedAssetIds,
    planchetaPreview,
    scanInput,
    setScanResult,
    selectAssetForModal,
  })
  const {
    adminAudits,
    adminAuditLoading,
    adminAuditPage,
    adminAuditTotal,
    loginAudits,
    loginAuditLoading,
    loginAuditPage,
    loginAuditTotal,
    loginMetrics,
    loginMetricsHourly,
    loginMetricsByIp,
    loginMetricsByUser,
    metricsTop,
    setMetricsTop,
    hourlySort,
    setHourlySort,
    ipSort,
    setIpSort,
    userSort,
    setUserSort,
    metricsFilters,
    setMetricsFilters,
    auditFilters,
    setAuditFilters,
    loginAuditFilters,
    setLoginAuditFilters,
    auditCleanupForm,
    setAuditCleanupForm,
    applyAuditRangePreset,
    buildAdminAuditParams,
    buildLoginAuditParams,
    resetAdminAuditFilters,
    resetLoginAuditFilters,
    loadAdminAudits,
    loadLoginAudits,
    loadLoginMetrics,
    runAuditCleanup,
  } = useAuditAdmin({
    api,
    setErr,
    setOk,
    openConfirm,
    closeConfirm,
  })
  const [showHeroNotice, setShowHeroNotice] = useState(true)

  useEffect(() => {
    if (!isAuthed) {
      setShowHeroNotice(true)
      return
    }
    setShowHeroNotice(true)
    const hideId = setTimeout(() => setShowHeroNotice(false), 3000)
    return () => clearTimeout(hideId)
  }, [isAuthed])

  useEffect(() => {
    if (!isAuthed) return
    const id = setInterval(async () => {
      await refreshSessionToken()
    }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthed])

  useEffect(() => {
    if (!showIntro) return
    const video = introVideoRef.current
    if (!video) return

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        window.setTimeout(() => {
          closeIntro()
        }, 1800)
      })
    }
  }, [showIntro, closeIntro])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const prefs = JSON.parse(raw)
      if (prefs.activeTab) {
        const legacyTab = prefs.activeTab
        if (legacyTab === 'bulk') {
          setActiveTab('imports')
          setImportsView('assets')
        } else if (legacyTab === 'catalogImport') {
          setActiveTab('imports')
          setImportsView('catalog')
        } else if (legacyTab === 'baseSn') {
          setActiveTab('imports')
          setImportsView('sn')
        } else {
          setActiveTab(legacyTab)
        }
      }
      if (prefs.importsView) {
        const rawImportsView = String(prefs.importsView)
        if (rawImportsView === 'bulk' || rawImportsView === 'assets') {
          setImportsView('assets')
        } else if (rawImportsView === 'catalogImport' || rawImportsView === 'catalog') {
          setImportsView('catalog')
        } else if (rawImportsView === 'baseSn' || rawImportsView === 'sn') {
          setImportsView('sn')
        } else {
          setImportsView('assets')
        }
      }
      if (prefs.instQuery !== undefined) setInstQuery(prefs.instQuery)
      if (prefs.instSort) setInstSort(prefs.instSort)
      if (prefs.estFilters) setEstFilters(prefs.estFilters)
      if (prefs.estSort) setEstSort(prefs.estSort)
      if (prefs.depFilters) setDepFilters(prefs.depFilters)
      if (prefs.depSort) setDepSort(prefs.depSort)
      if (prefs.metricsFilters) setMetricsFilters(prefs.metricsFilters)
      if (prefs.metricsTop) setMetricsTop(prefs.metricsTop)
      if (prefs.hourlySort) setHourlySort(prefs.hourlySort)
      if (prefs.ipSort) setIpSort(prefs.ipSort)
      if (prefs.userSort) setUserSort(prefs.userSort)
    } catch {
      // ignore invalid storage
    }
  }, [])

  useEffect(() => {
    const prefs = {
      activeTab,
      importsView,
      instQuery,
      instSort,
      estFilters,
      estSort,
      depFilters,
      depSort,
      metricsFilters,
      metricsTop,
      hourlySort,
      ipSort,
      userSort,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [
    activeTab,
    importsView,
    instQuery,
    instSort,
    estFilters,
    estSort,
    depFilters,
    depSort,
    metricsFilters,
    metricsTop,
    hourlySort,
    ipSort,
    userSort,
  ])

  function resetPreferences() {
    localStorage.removeItem(STORAGE_KEY)
    setActiveTab('institutions')
    setImportsView('assets')
    setInstQuery('')
    setInstSort({ key: 'name', order: 'asc' })
    setEstFilters({ q: '', institutionId: '', institutionSearch: '' })
    setEstSort({ key: 'name', order: 'asc' })
    setDepFilters({ q: '', establishmentId: '', establishmentSearch: '' })
    setDepSort({ key: 'name', order: 'asc' })
    setMetricsFilters({ fromDate: '', toDate: '', hourFrom: '', hourTo: '' })
    setMetricsTop(10)
    setHourlySort({ key: 'hour', order: 'asc' })
    setIpSort({ key: 'failed', order: 'desc' })
    setUserSort({ key: 'failed', order: 'desc' })
    setOk('Preferencias reiniciadas.')
  }

  function clampTake(raw) {
    const n = Number(raw)
    if (!Number.isFinite(n)) return MAX_TAKE
    return Math.max(1, Math.min(MAX_TAKE, Math.trunc(n)))
  }

  function sanitizeTakeInPath(path) {
    const raw = String(path || '')
    if (!raw.includes('take=')) return raw
    const qIndex = raw.indexOf('?')
    if (qIndex < 0) return raw
    const base = raw.slice(0, qIndex)
    const query = raw.slice(qIndex + 1)
    const params = new URLSearchParams(query)
    if (!params.has('take')) return raw
    params.set('take', String(clampTake(params.get('take'))))
    return `${base}?${params.toString()}`
  }

  const API_ERROR_MESSAGES = {
    VALIDATION_ERROR: 'Datos inválidos. Revisa los campos e intenta nuevamente.',
    ROUTE_NOT_FOUND: 'Ruta no encontrada.',
    REFRESH_TOKEN_REQUIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    UNSUPPORTED_MEDIA_TYPE: 'Formato de envío inválido. Usa application/json.',
    PAYLOAD_TOO_LARGE: 'El archivo o payload excede el tamano permitido.',
    ASSET_IMPORT_FILE_REQUIRED: 'Debes adjuntar un archivo Excel para importar activos fijos.',
    CATALOG_IMPORT_FILE_REQUIRED: 'Debes adjuntar un archivo Excel para importar catalogo.',
    CATALOG_IMPORT_INVALID_FILE: 'El archivo no es un Excel .xlsx válido o está dañado.',
    PLANCHETA_EMPTY_EXPORT: 'No hay datos para exportar con los filtros actuales.',
    INVALID_ASSET_ID: 'El identificador de activo fijo no es válido.',
    FORCE_DELETE_CONFIRMATION_INVALID: 'Confirmación inválida para eliminación forzada.',
    USER_FORCE_DELETE_SELF: 'No puedes eliminar forzadamente tu propio usuario.',
    USER_HARD_DELETE_REQUIRES_INACTIVE: 'Primero debes desactivar el usuario.',
    ASSET_HARD_DELETE_REQUIRES_DELETED: 'Primero debes dar de baja el activo fijo.',
    PASSWORD_CURRENT_INVALID: 'La clave actual no coincide.',
    PASSWORD_NEW_SAME_AS_CURRENT: 'La nueva clave debe ser distinta a la actual.',
    UNAUTHORIZED: 'No autorizado. Inicia sesión nuevamente.',
    FORBIDDEN: 'No tienes permisos para realizar esta acción.',
    NOT_FOUND: 'No se encontro el recurso solicitado.',
    CONFLICT: 'Conflicto de datos. Revisa los campos e intenta nuevamente.',
    RATE_LIMITED: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
    INTERNAL_SERVER_ERROR: 'Error interno del servidor. Intenta nuevamente.',
    READINESS_DB_TIMEOUT: 'La base de datos no respondio a tiempo.',
    READINESS_DB_DOWN: 'La base de datos no esta disponible.',
    SUPPORT_INVALID_SCOPE: 'El alcance seleccionado no existe o es invalido.',
    SUPPORT_INVALID_STATUS: 'El estado solicitado no es valido.',
  }

  function getFallbackCodeByStatus(status) {
    if (status === 400) return 'BAD_REQUEST'
    if (status === 401) return 'UNAUTHORIZED'
    if (status === 403) return 'FORBIDDEN'
    if (status === 404) return 'NOT_FOUND'
    if (status === 409) return 'CONFLICT'
    if (status === 413) return 'PAYLOAD_TOO_LARGE'
    if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE'
    if (status === 429) return 'RATE_LIMITED'
    if (status >= 500) return 'INTERNAL_SERVER_ERROR'
    return `HTTP_${status}`
  }

  function resolveApiErrorMessage({ status, code, serverMessage, requestId }) {
    const base =
      API_ERROR_MESSAGES[code] ||
      (status >= 500 ? API_ERROR_MESSAGES.INTERNAL_SERVER_ERROR : null) ||
      serverMessage ||
      `HTTP ${status}`
    return requestId ? `${base} (ID: ${requestId})` : base
  }

  function getLoginErrorMessage(errorOrMessage) {
    if (typeof errorOrMessage === 'string' && errorOrMessage.trim()) {
      return errorOrMessage
    }
    if (errorOrMessage?.code === 'UNAUTHORIZED') {
      return 'Datos inválidos. Revisa tus credenciales e intenta nuevamente.'
    }
    if (errorOrMessage?.code === 'VALIDATION_ERROR') {
      return 'Ingresa tu email y contraseña para continuar.'
    }
    return 'No se pudo iniciar sesión. Revisa tus credenciales e intenta nuevamente.'
  }

  function resolveAuthToken(overrideToken) {
    if (overrideToken) return overrideToken
    const persisted = localStorage.getItem('admin_token')
    if (persisted) return persisted
    return token || ''
  }

  async function refreshSessionToken() {
    if (refreshTokenPromiseRef.current) return refreshTokenPromiseRef.current
    refreshTokenPromiseRef.current = (async () => {
      try {
        const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!refreshed.ok) return ''
        const data = await refreshed.json()
        const nextToken = data?.token || ''
        if (!nextToken) return ''
        localStorage.setItem('admin_token', nextToken)
        setToken(nextToken)
        return nextToken
      } catch {
        return ''
      } finally {
        refreshTokenPromiseRef.current = null
      }
    })()
    return refreshTokenPromiseRef.current
  }

  async function api(path, { method = 'GET', body, retry = true, overrideToken = '' } = {}) {
    const normalizedPath = sanitizeTakeInPath(path)
    const authToken = resolveAuthToken(overrideToken)
    const res = await fetch(`${API_BASE}${normalizedPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401 && retry) {
      const nextToken = await refreshSessionToken()
      if (nextToken) {
        return api(normalizedPath, {
          method,
          body,
          retry: false,
          overrideToken: nextToken,
        })
      }
    }

    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    if (!res.ok) {
      const requestId = json?.requestId || res.headers.get('x-request-id') || null
      const code = json?.code || getFallbackCodeByStatus(res.status)
      const msg = resolveApiErrorMessage({
        status: res.status,
        code,
        serverMessage: json?.error || text || `HTTP ${res.status}`,
        requestId,
      })
      const err = new Error(msg)
      err.status = res.status
      err.code = code
      err.requestId = requestId
      err.details = json?.details || null
      throw err
    }
    return json
  }

  async function apiMultipart(
    path,
    { method = 'POST', formData, retry = true, overrideToken = '' } = {}
  ) {
    const normalizedPath = sanitizeTakeInPath(path)
    const authToken = resolveAuthToken(overrideToken)
    const res = await fetch(`${API_BASE}${normalizedPath}`, {
      method,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: 'include',
      body: formData,
    })

    if (res.status === 401 && retry) {
      const nextToken = await refreshSessionToken()
      if (nextToken) {
        return apiMultipart(normalizedPath, {
          method,
          formData,
          retry: false,
          overrideToken: nextToken,
        })
      }
    }

    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    if (!res.ok) {
      const requestId = json?.requestId || res.headers.get('x-request-id') || null
      const code = json?.code || getFallbackCodeByStatus(res.status)
      const msg = resolveApiErrorMessage({
        status: res.status,
        code,
        serverMessage: json?.error || text || `HTTP ${res.status}`,
        requestId,
      })
      const err = new Error(msg)
      err.status = res.status
      err.code = code
      err.requestId = requestId
      err.details = json?.details || null
      throw err
    }
    return json
  }

  async function downloadFile(path, filename, overrideToken = '') {
    const normalizedPath = sanitizeTakeInPath(path)
    const authToken = resolveAuthToken(overrideToken)
    const res = await fetch(`${API_BASE}${normalizedPath}`, {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    })
    if (res.status === 401) {
      const nextToken = await refreshSessionToken()
      if (nextToken) {
        return downloadFile(normalizedPath, filename, nextToken)
      }
    }
    if (!res.ok) {
      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      const requestId = json?.requestId || res.headers.get('x-request-id') || null
      const code = json?.code || getFallbackCodeByStatus(res.status)
      const msg = resolveApiErrorMessage({
        status: res.status,
        code,
        serverMessage: json?.error || text || `HTTP ${res.status}`,
        requestId,
      })
      const err = new Error(msg)
      err.status = res.status
      err.code = code
      err.requestId = requestId
      err.details = json?.details || null
      throw err
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  async function previewFile(path, filename = 'preview.bin', overrideToken = '') {
    const normalizedPath = sanitizeTakeInPath(path)
    const authToken = resolveAuthToken(overrideToken)
    const res = await fetch(`${API_BASE}${normalizedPath}`, {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    })
    if (res.status === 401) {
      const nextToken = await refreshSessionToken()
      if (nextToken) {
        return previewFile(normalizedPath, filename, nextToken)
      }
    }
    if (!res.ok) {
      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      const requestId = json?.requestId || res.headers.get('x-request-id') || null
      const code = json?.code || getFallbackCodeByStatus(res.status)
      const msg = resolveApiErrorMessage({
        status: res.status,
        code,
        serverMessage: json?.error || text || `HTTP ${res.status}`,
        requestId,
      })
      const err = new Error(msg)
      err.status = res.status
      err.code = code
      err.requestId = requestId
      err.details = json?.details || null
      throw err
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
      window.URL.revokeObjectURL(url)
      throw new Error('El navegador bloqueo la ventana de previsualizacion.')
    }
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 60000)
  }

  async function apiText(path, { method = 'GET', retry = true, overrideToken = '' } = {}) {
    const normalizedPath = sanitizeTakeInPath(path)
    const authToken = resolveAuthToken(overrideToken)
    const res = await fetch(`${API_BASE}${normalizedPath}`, {
      method,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: 'include',
    })

    if (res.status === 401 && retry) {
      const nextToken = await refreshSessionToken()
      if (nextToken) {
        return apiText(normalizedPath, {
          method,
          retry: false,
          overrideToken: nextToken,
        })
      }
    }

    const text = await res.text()
    if (!res.ok) {
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      const requestId = json?.requestId || res.headers.get('x-request-id') || null
      const code = json?.code || getFallbackCodeByStatus(res.status)
      const msg = resolveApiErrorMessage({
        status: res.status,
        code,
        serverMessage: json?.error || text || `HTTP ${res.status}`,
        requestId,
      })
      const err = new Error(msg)
      err.status = res.status
      err.code = code
      err.requestId = requestId
      err.details = json?.details || null
      throw err
    }
    return text
  }

  function csvEscape(value) {
    const text = String(value ?? '')
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  function downloadCsv(filename, headers, rows) {
    const lines = [headers.map(csvEscape).join(',')]
    rows.forEach((row) => {
      lines.push(row.map(csvEscape).join(','))
    })
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  function getCatalogConflictMessage(err, fallback) {
    if (err?.status !== 409) {
      return err?.message || fallback
    }
    if (err?.code === 'CATALOG_ITEM_DUPLICATE_OFFICIAL_KEY') {
      return 'officialKey ya existe en otro item de catalogo.'
    }
    if (err?.code === 'CATALOG_ITEM_DUPLICATE_COMPOSITE') {
      return 'Ya existe un item con la misma combinacion de nombre/categoria/subcategoria/marca/modelo.'
    }
    if (err?.code === 'CATALOG_ITEM_HAS_ASSETS') {
      return 'No se puede eliminar: hay activos fijos asociados.'
    }
    return err?.message || fallback
  }

  function getInstitutionConflictMessage(err, fallback) {
    if (err?.status !== 409) {
      return err?.message || fallback
    }
    if (err?.code === 'INSTITUTION_SINGLETON_LOCKED') {
      return 'Este sistema permite mantener solo una institucion.'
    }
    if (err?.code === 'INSTITUTION_ALREADY_INACTIVE') {
      return 'La institucion ya estaba inactiva.'
    }
    if (err?.code === 'INSTITUTION_ALREADY_ACTIVE') {
      return 'La institucion ya estaba activa.'
    }
    if (err?.code === 'INSTITUTION_HAS_ACTIVE_ESTABLISHMENTS') {
      return 'No se puede dar de baja: tiene establecimientos activos.'
    }
    if (err?.code === 'INSTITUTION_HAS_ACTIVE_USERS') {
      return 'No se puede dar de baja: tiene usuarios activos.'
    }
    if (err?.code === 'INSTITUTION_HAS_ACTIVE_ASSETS') {
      return 'No se puede dar de baja: tiene activos vigentes.'
    }
    if (err?.code === 'INSTITUTION_HARD_DELETE_REQUIRES_INACTIVE') {
      return 'Para eliminar definitivamente, primero debes dar de baja la institucion.'
    }
    if (err?.code === 'INSTITUTION_HARD_DELETE_HAS_RELATIONS') {
      return 'No se puede eliminar definitivamente: todavia tiene registros relacionados.'
    }
    return err?.message || fallback
  }

  function getEstablishmentConflictMessage(err, fallback) {
    if (err?.status !== 409) {
      return err?.message || fallback
    }
    if (err?.code === 'ESTABLISHMENT_ALREADY_INACTIVE') {
      return 'El establecimiento ya estaba inactivo.'
    }
    if (err?.code === 'ESTABLISHMENT_ALREADY_ACTIVE') {
      return 'El establecimiento ya estaba activo.'
    }
    if (err?.code === 'ESTABLISHMENT_HAS_ACTIVE_DEPENDENCIES') {
      return 'No se puede dar de baja: tiene sectores activos.'
    }
    if (err?.code === 'ESTABLISHMENT_HAS_ACTIVE_USERS') {
      return 'No se puede dar de baja: tiene usuarios activos.'
    }
    if (err?.code === 'ESTABLISHMENT_HAS_ACTIVE_ASSETS') {
      return 'No se puede dar de baja: tiene activos vigentes.'
    }
    if (err?.code === 'ESTABLISHMENT_HARD_DELETE_REQUIRES_INACTIVE') {
      return 'Para eliminar definitivamente, primero debes dar de baja el establecimiento.'
    }
    if (err?.code === 'ESTABLISHMENT_HARD_DELETE_HAS_RELATIONS') {
      return 'No se puede eliminar definitivamente: todavia tiene registros relacionados.'
    }
    return err?.message || fallback
  }

  function getDependencyConflictMessage(err, fallback) {
    if (err?.status !== 409) {
      return err?.message || fallback
    }
    if (err?.code === 'DEPENDENCY_ALREADY_INACTIVE') {
      return 'El sector ya estaba inactivo.'
    }
    if (err?.code === 'DEPENDENCY_ALREADY_ACTIVE') {
      return 'El sector ya estaba activo.'
    }
    if (err?.code === 'DEPENDENCY_HAS_ACTIVE_ASSETS') {
      return 'No se puede dar de baja: tiene activos vigentes.'
    }
    if (err?.code === 'DEPENDENCY_HARD_DELETE_REQUIRES_INACTIVE') {
      return 'Para eliminar definitivamente, primero debes dar de baja el sector.'
    }
    if (err?.code === 'DEPENDENCY_HARD_DELETE_HAS_RELATIONS') {
      return 'No se puede eliminar definitivamente: todavia tiene registros relacionados.'
    }
    return err?.message || fallback
  }

  function getMoveConflictMessage(err, fallback) {
    if (err?.status !== 409) {
      return err?.message || fallback
    }
    if (err?.code === 'ASSET_RELOCATE_ASSET_DELETED') {
      return 'No se puede mover: el activo fijo esta dado de baja.'
    }
    if (err?.code === 'ASSET_RELOCATE_SAME_DEPENDENCY') {
      return 'El activo fijo ya esta en ese sector.'
    }
    if (err?.code === 'ASSET_RELOCATE_TARGET_DEPENDENCY_INACTIVE') {
      return 'No se puede mover: el sector destino esta inactivo.'
    }
    if (err?.code === 'ASSET_RELOCATE_CROSS_ESTABLISHMENT_FORBIDDEN') {
      return 'No se puede mover a un sector de otro establecimiento.'
    }
    return err?.message || fallback
  }

  function getAssetCreateConflictMessage(err, fallback) {
    if (err?.status !== 409) {
      return err?.message || fallback
    }
    if (err?.code === 'ASSET_INTERNAL_CODE_CONFLICT') {
      return 'Conflicto al generar el codigo interno del activo fijo. Intenta nuevamente.'
    }
    return err?.message || fallback
  }

  function downloadCatalogImportReport(kind) {
    if (!catalogImportResult) return
    if (kind === 'errors') {
      const rows = (catalogImportResult.errors || []).map((item) => [
        item.row ?? '',
        item.error || '',
      ])
      downloadCsv('catalog_import_errors.csv', ['row', 'error'], rows)
      return
    }
    if (kind === 'skipped') {
      const rows = (catalogImportResult.skipped || []).map((item) => [
        item.name || '',
        item.category || '',
        item.subcategory || '',
        item.brand || '',
        item.modelName || '',
        item.reason || '',
        item.dedupeBy || '',
      ])
      downloadCsv(
        'catalog_import_skipped.csv',
        ['name', 'category', 'subcategory', 'brand', 'modelName', 'reason', 'dedupeBy'],
        rows
      )
      return
    }
    if (kind === 'created') {
      const rows = (catalogImportResult.items || []).map((item) => [
        item.id ?? '',
        item.name || '',
        item.category || '',
        item.subcategory || '',
        item.brand || '',
        item.modelName || '',
      ])
      downloadCsv(
        'catalog_import_created.csv',
        ['id', 'name', 'category', 'subcategory', 'brand', 'modelName'],
        rows
      )
    }
  }

  async function purgeCatalogAllWithReset() {
    openConfirm({
      title: 'Vaciar catalogo',
      message:
        'Se eliminaran todos los items del catalogo, se desvincularan de activos y el ID volvera a 1. Continuar?',
      onConfirm: async () => {
        try {
          const result = await api('/admin/catalog-items/purge/reset', { method: 'DELETE' })
          await loadCatalogAdminItems(1)
          await loadCatalogItems()
          setOk(
            `Catalogo vaciado. Eliminados: ${Number(result?.deletedCount || 0)}. Proximo ID: 1.`
          )
        } catch (err) {
          setErr(err, UI_ERROR.couldNotClear('el catalogo'))
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function guardedPurgeCatalogAllWithReset() {
    if (!dangerZoneUnlocked) {
      setErr('Acciones críticas bloqueadas. Usa "Habilitar acciones críticas".')
      return
    }
    return purgeCatalogAllWithReset()
  }

  function setOk(message) {
    setStatus({ type: 'ok', message, code: null, requestId: null, details: null })
    setStatusCopyFeedback('')
    setFormErrors({})
  }
  function setErr(errorOrMessage, fallbackMessage = 'Ocurrio un error.') {
    setStatusCopyFeedback('')
    if (errorOrMessage && typeof errorOrMessage === 'object') {
      setStatus({
        type: 'error',
        message: errorOrMessage.message || fallbackMessage,
        code: errorOrMessage.code || 'UNKNOWN_ERROR',
        requestId: errorOrMessage.requestId || null,
        details: errorOrMessage.details || null,
      })
      return
    }
    const message =
      typeof errorOrMessage === 'string' && errorOrMessage.trim()
        ? errorOrMessage
        : fallbackMessage
    setStatus({
      type: 'error',
      message,
      code: 'UNKNOWN_ERROR',
      requestId: null,
      details: null,
    })
  }

  function withMappedError(errorObject, mappedMessage, fallbackMessage = 'Ocurrio un error.') {
    if (errorObject && typeof errorObject === 'object') {
      return {
        ...errorObject,
        message:
          typeof mappedMessage === 'string' && mappedMessage.trim()
            ? mappedMessage
            : errorObject.message || fallbackMessage,
      }
    }
    return mappedMessage || fallbackMessage
  }


  function copyStatusRequestId() {
    const requestId = String(status.requestId || '').trim()
    if (!requestId || requestId === 'N/A') return
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(requestId)
        .then(() => setStatusCopyFeedback('ID copiado'))
        .catch(() => setStatusCopyFeedback('No se pudo copiar el ID'))
      return
    }
    setStatusCopyFeedback('Portapapeles no disponible en este navegador')
  }

  function copyStatusDetailsJson() {
    const payload = {
      code: status.code || 'UNKNOWN_ERROR',
      requestId: status.requestId || null,
      details: status.details || null,
      message: status.message || null,
      copiedAt: new Date().toISOString(),
    }
    const text = JSON.stringify(payload, null, 2)
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(text)
        .then(() => setStatusCopyFeedback('Detalle JSON copiado'))
        .catch(() => setStatusCopyFeedback('No se pudo copiar el detalle JSON'))
      return
    }
    setStatusCopyFeedback('Portapapeles no disponible en este navegador')
  }


  function openConfirm({ title, message, onConfirm }) {
    setConfirmState({ open: true, title, message, onConfirm })
  }

  function closeConfirm() {
    setConfirmState({ open: false, title: '', message: '', onConfirm: null })
  }

  function openDeleteBlockModal({ title, summary, dependencies }) {
    setDeleteBlockState({
      open: true,
      title: title || 'No se puede completar la accion',
      summary: summary || null,
      dependencies: Array.isArray(dependencies) ? dependencies : [],
    })
  }

  function closeDeleteBlockModal() {
    setDeleteBlockState({
      open: false,
      title: '',
      summary: null,
      dependencies: [],
    })
  }

  function getForceDeleteConfig(entityType, entityId) {
    if (entityType === 'institution') {
      return {
        summaryPath: `/admin/institutions/${entityId}/permanent/summary`,
        forcePath: `/admin/institutions/${entityId}/permanent/force`,
        reload: async () => {
          await loadInstitutions(instPage)
        },
      }
    }
    if (entityType === 'establishment') {
      return {
        summaryPath: `/admin/establishments/${entityId}/permanent/summary`,
        forcePath: `/admin/establishments/${entityId}/permanent/force`,
        reload: async () => {
          await loadEstablishments(estPage)
        },
      }
    }
    if (entityType === 'dependency') {
      return {
        summaryPath: `/admin/dependencies/${entityId}/permanent/summary`,
        forcePath: `/admin/dependencies/${entityId}/permanent/force`,
        reload: async () => {
          await loadDependencies(depPage)
        },
      }
    }
    if (entityType === 'user') {
      return {
        summaryPath: `/admin/users/${entityId}/permanent/summary`,
        forcePath: `/admin/users/${entityId}/permanent/force`,
        reload: async () => {
          await loadUsersAdmin(usersPage)
        },
      }
    }
    if (entityType === 'catalogItem') {
      return {
        summaryPath: `/admin/catalog-items/${entityId}/permanent/summary`,
        forcePath: `/admin/catalog-items/${entityId}/permanent/force`,
        reload: async () => {
          await loadCatalogAdminItems(catalogAdminPage)
        },
      }
    }
    if (entityType === 'asset') {
      return {
        summaryPath: `/assets/${entityId}/permanent/summary`,
        forcePath: `/assets/${entityId}/permanent/force`,
        reload: async () => {
          await loadTrash()
          await loadAssetsList(assetListPage)
        },
      }
    }
    throw new Error(`Tipo de eliminacion forzada no soportado: ${entityType}`)
  }

  async function openForceDelete(entityType, entityId, entityLabel) {
    const { summaryPath } = getForceDeleteConfig(entityType, entityId)
    setForceDeleteState({
      open: true,
      entityType,
      entityId,
      entityLabel: entityLabel || `#${entityId}`,
      summary: null,
      details: null,
      confirmationText: '',
      expectedConfirmationText: 'ELIMINAR DEFINITIVO',
      loading: true,
      deleting: false,
    })
    try {
      const data = await api(summaryPath)
      setForceDeleteState((prev) => ({
        ...prev,
        summary: data?.summary || null,
        details: data?.details || null,
        expectedConfirmationText: data?.confirmationText || 'ELIMINAR DEFINITIVO',
        loading: false,
      }))
    } catch (err) {
      setErr(err, UI_ERROR.couldNotLoad('el resumen de eliminacion forzada'))
      setForceDeleteState((prev) => ({
        ...prev,
        loading: false,
        open: false,
      }))
    }
  }

  function closeForceDelete() {
    setForceDeleteState({
      open: false,
      entityType: '',
      entityId: null,
      entityLabel: '',
      summary: null,
      details: null,
      confirmationText: '',
      expectedConfirmationText: 'ELIMINAR DEFINITIVO',
      loading: false,
      deleting: false,
    })
  }

  async function confirmForceDelete() {
    if (!forceDeleteState.entityType || !forceDeleteState.entityId) return
    const typed = String(forceDeleteState.confirmationText || '').trim()
    const expected = String(forceDeleteState.expectedConfirmationText || '').trim()
    if (!typed || typed !== expected) {
      setErr(`Debes escribir exactamente: ${expected}`)
      return
    }
    const { forcePath, reload } = getForceDeleteConfig(
      forceDeleteState.entityType,
      forceDeleteState.entityId
    )
    setForceDeleteState((prev) => ({ ...prev, deleting: true }))
    try {
      await api(forcePath, {
        method: 'DELETE',
        body: { confirmationText: typed },
      })
      await reload()
      setOk(UI_STATUS.forceDeleteCompleted)
      closeForceDelete()
    } catch (err) {
      setErr(err, UI_ERROR.couldNotComplete('la eliminacion forzada'))
      setForceDeleteState((prev) => ({ ...prev, deleting: false }))
    }
  }

  function validateAssetForm() {
    const errors = {}
    const useMultiProduct = assetMultiProductEnabled
    if (!assetForm.establishmentId) errors.establishmentId = 'Requerido'
    if (!assetForm.dependencyId) errors.dependencyId = 'Requerido'
    if (!assetForm.assetStateId) errors.assetStateId = 'Requerido'
    if (!assetForm.assetTypeId) errors.assetTypeId = 'Requerido'
    if (!useMultiProduct && !assetForm.catalogItemId && !assetForm.name) {
      errors.name = 'Requerido si no hay catalogo'
    }
    if (!assetForm.accountingAccount) errors.accountingAccount = 'Requerido'
    if (useMultiProduct) {
      if (!assetMultiProducts.length) {
        errors.multiProducts = 'Debes agregar al menos un producto.'
      } else {
        for (let i = 0; i < assetMultiProducts.length; i++) {
          const row = assetMultiProducts[i]
          const rowCatalogId = toPositiveIntOrNull(row.catalogItemId)
          const rowQuantity = Number(row.quantity)
          const rowValue = Number(row.acquisitionValue)
          if (!rowCatalogId) {
            errors.multiProducts = `Producto ${i + 1}: selecciona un item de catalogo.`
            break
          }
          if (!Number.isInteger(rowQuantity) || rowQuantity <= 0) {
            errors.multiProducts = `Producto ${i + 1}: cantidad invalida (entero > 0).`
            break
          }
          if (!row.acquisitionValue || !Number.isFinite(rowValue) || rowValue <= 0) {
            errors.multiProducts = `Producto ${i + 1}: precio invalido (> 0).`
            break
          }
        }
      }
    } else {
      const quantity = Number(assetForm.quantity)
      if (!assetForm.quantity || !Number.isInteger(quantity) || quantity <= 0) {
        errors.quantity = 'Debe ser un entero mayor a 0'
      }
    }
    if (!useMultiProduct && !assetForm.acquisitionValue) errors.acquisitionValue = 'Requerido'
    if (assetForm.usefulLifeYears !== '') {
      const years = Number(assetForm.usefulLifeYears)
      if (!Number.isInteger(years) || years <= 0) {
        errors.usefulLifeYears = 'Debe ser un entero mayor a 0'
      }
    }
    if (assetForm.residualValue !== '') {
      const residual = Number(assetForm.residualValue)
      if (!Number.isFinite(residual) || residual < 0 || residual >= 100) {
        errors.residualValue = 'Debe ser un porcentaje entre 0 y menor a 100'
      }
    }
    if (assetForm.depreciationStartDate) {
      const startDate = new Date(assetForm.depreciationStartDate)
      if (Number.isNaN(startDate.getTime())) {
        errors.depreciationStartDate = 'Fecha invalida'
      } else if (startDate.getTime() > Date.now()) {
        errors.depreciationStartDate = 'No puede ser futura'
      }
    }
    if (!useMultiProduct && assetForm.usefulLifeYears !== '') {
      const depreciation = calculateStraightLineDepreciation({
        acquisitionValue: assetForm.acquisitionValue,
        usefulLifeYears: assetForm.usefulLifeYears,
        residualValue: assetForm.residualValue,
      })
      if (!depreciation) {
        errors.depreciationConfig =
          'Configura vida util y porcentaje residual validos (0 a menor de 100).'
      }
    }
    if (!assetForm.acquisitionDate) errors.acquisitionDate = 'Requerido'
    if (assetHasResponsible && assetForm.responsibleRut) {
      const rut = String(assetForm.responsibleRut).trim()
      const compact = rut.replace(/\./g, '').replace(/\s+/g, '').toUpperCase()
      if (!/^\d{7,8}-?[\dK]$/.test(compact)) {
        errors.responsibleRut = 'RUT invalido. Usa formato 12345678-9'
      }
    }
    return errors
  }

  function normalizeRutValue(value) {
    const raw = String(value || '').trim().toUpperCase()
    if (!raw) return ''
    const compact = raw.replace(/\./g, '').replace(/\s+/g, '')
    const match = compact.match(/^(\d{7,8})-?([\dK])$/)
    if (!match) return raw
    return `${match[1]}-${match[2]}`
  }

  function normalizeCostCenterValue(value) {
    return String(value || '').trim().toUpperCase()
  }

  function calculateStraightLineDepreciation({ acquisitionValue, usefulLifeYears, residualValue }) {
    const acquisition = Number(acquisitionValue)
    const lifeYears = Number(usefulLifeYears)
    const residualRate = residualValue === '' || residualValue === null ? 0 : Number(residualValue)
    if (!Number.isFinite(acquisition) || acquisition <= 0) return null
    if (!Number.isInteger(lifeYears) || lifeYears <= 0) return null
    if (!Number.isFinite(residualRate) || residualRate < 0 || residualRate >= 100) return null

    const residualAmount = Number((acquisition * (residualRate / 100)).toFixed(2))
    const depreciableBase = Number((acquisition - residualAmount).toFixed(2))
    if (depreciableBase <= 0) return null
    const annual = Number((depreciableBase / lifeYears).toFixed(2))
    const monthly = Number((annual / 12).toFixed(2))
    const rate = Number(((annual / acquisition) * 100).toFixed(6))

    return {
      depreciableBase,
      annual,
      monthly,
      rate,
      residualRate,
      residualAmount,
      usefulLifeYears: lifeYears,
    }
  }

  async function suggestAssetDepreciation(selectedCatalogItem) {
    if (!selectedCatalogItem?.id) return
    try {
      const payload = {
        catalogItemId: Number(selectedCatalogItem.id),
        assetTypeId: assetForm.assetTypeId ? Number(assetForm.assetTypeId) : undefined,
        accountingAccount: assetForm.accountingAccount || undefined,
        name: assetForm.name || selectedCatalogItem.name || undefined,
        acquisitionValue: assetForm.acquisitionValue ? Number(assetForm.acquisitionValue) : undefined,
        acquisitionDate: assetForm.acquisitionDate || undefined,
        depreciationStartDate: assetForm.depreciationStartDate || undefined,
        usefulLifeYears: assetForm.usefulLifeYears ? Number(assetForm.usefulLifeYears) : undefined,
        depreciationAnnualValue: undefined,
        depreciationAnnualRate: undefined,
      }
      const suggestion = await api('/assets/depreciation/suggest', {
        method: 'POST',
        body: payload,
      })
      if (!suggestion) return
      setAssetForm((prev) => {
        const next = { ...prev }
        if (suggestion.usefulLifeYears) {
          next.usefulLifeYears = String(suggestion.usefulLifeYears)
        }
        if (!next.depreciationStartDate && suggestion.depreciationStartDate) {
          next.depreciationStartDate = String(suggestion.depreciationStartDate).slice(0, 10)
        }
        return next
      })
    } catch {
      // Sugerencia opcional, no bloquea el alta.
    }
  }

  function toPositiveIntOrNull(value) {
    const raw = String(value ?? '').trim()
    if (!raw) return null
    if (!/^\d+$/.test(raw)) return null
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) return null
    return parsed
  }

  function getSafeAssetId(assetLike) {
    return toPositiveIntOrNull(assetLike?.id)
  }

  function extractCatalogDetail(description) {
    const text = String(description || '')
    const match = text.match(/Detalle:\s*([^|]+)/i)
    return match?.[1]?.trim() || ''
  }

  function formatCatalogItemDisplay(item) {
    if (!item) return ''
    const parts = [item.name, item.brand, item.modelName]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
    const detail = extractCatalogDetail(item.description)
    if (detail) parts.push(detail)
    if (parts.length) return parts.join(' / ')
    return [item.name, item.category].filter(Boolean).join(' - ')
  }

  function sanitizeMultiProductCount(value) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 1
    return Math.max(1, Math.min(20, Math.trunc(parsed)))
  }

  function resizeMultiProducts(rawCount) {
    const nextCount = sanitizeMultiProductCount(rawCount)
    setAssetMultiProductCount(String(nextCount))
    setAssetMultiProducts((prev) => {
      const next = []
      for (let i = 0; i < nextCount; i++) {
        const current = prev[i] || {}
        next.push({
          catalogItemId: String(current.catalogItemId || ''),
          quantity: current.quantity ? String(current.quantity) : '1',
          acquisitionValue:
            current.acquisitionValue !== undefined && current.acquisitionValue !== null
              ? String(current.acquisitionValue)
              : '',
        })
      }
      return next
    })
  }

  async function purgeAssetsAllWithReset(options = {}) {
    const forceStructureDelete = Boolean(options?.forceStructureDelete)
    const endpoint = forceStructureDelete
      ? '/assets/purge/reset?purgeDependencies=true&purgeEstablishments=true&forceDeleteStructure=true'
      : '/assets/purge/reset'
    const expectedConfirmationText = 'ELIMINAR DEFINITIVO'
    openConfirm({
      title: forceStructureDelete
        ? 'Vaciar activos + eliminar estructura (forzado)'
        : 'Vaciar activos fijos',
      message: forceStructureDelete
        ? 'Se eliminar\u00e1n todos los activos fijos, evidencias, movimientos e historial de importaciones. Adem\u00e1s, se eliminar\u00e1n forzadamente sectores y establecimientos (incluyendo relaciones asociadas) cuando aplique. \u00bfContinuar?'
        : 'Se eliminar\u00e1n todos los activos fijos, evidencias, movimientos e historial de importaciones. El ID y el c\u00f3digo interno volver\u00e1n a 1. \u00bfContinuar?',
      onConfirm: async () => {
        try {
          if (forceStructureDelete) {
            const typed = window.prompt(
              `Escribe exactamente "${expectedConfirmationText}" para confirmar el borrado forzado de estructura:`,
              ''
            )
            if (String(typed || '').trim() !== expectedConfirmationText) {
              setErr(`Debes escribir exactamente: ${expectedConfirmationText}`)
              return
            }
          }
          const result = await api(endpoint, { method: 'DELETE' })
          await loadAssetsList(1)
          await loadImportHistory(1)
          setImportResult(null)
          setImportHistoryOpen(null)
          const deletedAssets = Number(result?.deletedCount || 0)
          const deletedDeps = Number(result?.deletedDependencyCount || 0)
          const deletedEsts = Number(result?.deletedEstablishmentCount || 0)
          setOk(
            forceStructureDelete
              ? `Activos vaciados. Eliminados: ${deletedAssets}. Sectores eliminados: ${deletedDeps}. Establecimientos eliminados: ${deletedEsts}.`
              : `Activos vaciados. Eliminados: ${deletedAssets}. Pr\u00f3ximo ID: 1. Pr\u00f3ximo c\u00f3digo interno: 1.`
          )
        } catch (err) {
          setErr(err, 'No se pudieron vaciar los activos fijos.')
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function guardedPurgeAssetsAllWithReset(options = {}) {
    if (!dangerZoneUnlocked) {
      setErr('Acciones críticas bloqueadas. Usa "Habilitar acciones críticas".')
      return
    }
    return purgeAssetsAllWithReset(options)
  }

  function updateMultiProductRow(index, patch) {
    setAssetMultiProducts((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    )
  }

  const handleActiveTabDataLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab === 'institutions') {
      if (isCentral) {
        loadInstitutions(1)
      } else {
        loadInstitutionCatalog()
      }
    }
    if (activeTab === 'establishments') {
      if (isCentral) {
        loadInstitutionCatalog()
        loadEstablishments(1)
      } else if (currentUser?.institutionId) {
        loadEstablishmentCatalog(currentUser.institutionId)
      }
    }
    if (activeTab === 'dependencies') {
      if (isCentral) {
        loadInstitutionCatalog()
        loadEstablishmentCatalog()
        loadDependencies(1)
      } else if (currentUser?.establishmentId) {
        loadDependencyCatalog(currentUser.establishmentId)
      }
    }
    if (activeTab === 'users' && isCentral) {
      loadUsersAdmin(1)
      loadUserAssignmentOptions()
    }
    if (activeTab === 'assistant' && isCentral) {
      loadInstitutionCatalog()
      loadSupportRequests(1)
    }
    if (activeTab === 'imports' && importsView === 'assets') loadImportHistory(1)
    if (activeTab === 'assets') {
      const now = Date.now()
      if (assetsBootstrapPromiseRef.current) return
      if (now - assetsBootstrapLastRunRef.current < ASSETS_BOOTSTRAP_MIN_INTERVAL_MS) return
      assetsBootstrapLastRunRef.current = now
      assetsBootstrapPromiseRef.current = Promise.allSettled([
        loadAssetStates(),
        loadMovementReasonCodes(),
        loadAssetTypes(),
        loadCatalogItems(),
        loadAssetsList(),
        isCentral ? loadDepreciationRuns() : Promise.resolve(),
      ])
        .then((results) => {
          const firstRejected = results.find((result) => result.status === 'rejected')
          if (firstRejected && firstRejected.reason) {
            setErr(firstRejected.reason, 'No se pudieron cargar los datos de Activos Fijos.')
          }
        })
        .finally(() => {
          assetsBootstrapPromiseRef.current = null
        })
    }
    if (activeTab === 'imports' && importsView === 'catalog') {
      loadCatalogAdminItems(1)
    }
    if (activeTab === 'trash') {
      loadMovementReasonCodes()
      loadTrash()
    }
    if (activeTab === 'audit') {
      loadAdminAudits()
      loadLoginAudits()
      loadLoginMetrics()
    }
  })

  const handleInstitutionCatalogTabLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab === 'assets') {
      loadInstitutionCatalog()
      return
    }
    if (activeTab === 'institutions' && !isCentral) {
      loadInstitutionCatalog()
    }
  })

  const handleEstablishmentCatalogLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab !== 'establishments') return
    loadEstablishmentCatalog(estForm.institutionId)
  })

  const handleDependencyCatalogLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab !== 'dependencies') return
    loadDependencyCatalog(depForm.establishmentId)
  })

  const handleAssetEstablishmentsLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab !== 'assets') return
    if (!assetInstitutionId) {
      setAssetEstablishments([])
      return
    }
    loadAssetEstablishments(assetInstitutionId)
  })

  const handleAssetDependenciesLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab !== 'assets') return
    if (!assetForm.establishmentId) {
      setAssetDependencies([])
      return
    }
    loadAssetDependencies(assetForm.establishmentId)
  })

  const handleAssetListEstablishmentsLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab !== 'assets') return
    loadAssetListEstablishments(assetListFilters.institutionId)
  })

  const handleAssetListDependenciesLoad = useEffectEvent(() => {
    if (!isAuthed) return
    if (activeTab !== 'assets') return
    if (!assetListFilters.establishmentId) {
      setAssetListDependencies([])
      return
    }
    loadAssetListDependencies(assetListFilters.establishmentId)
  })

  const handleAssetsSearch = useEffectEvent(() => {
    loadAssetsList(1)
  })

  const restoreLastCreatedAsset = useEffectEvent(() => {
    if (!isAuthed) return
    const lastId = localStorage.getItem('last_asset_id')
    if (!lastId) return
    const safeLastId = toPositiveIntOrNull(lastId)
    if (!safeLastId) {
      localStorage.removeItem('last_asset_id')
      return
    }
    setEvidenceForm({ movementId: '', docType: 'ACTA', note: '', file: null })
    api(`/assets/${safeLastId}`)
      .then((asset) => setCreatedAsset(asset))
      .catch(() => {
        localStorage.removeItem('last_asset_id')
      })
  })

  const syncCreatedAssetDetails = useEffectEvent(() => {
    const safeAssetId = getSafeAssetId(createdAsset)
    if (!safeAssetId) {
      setAssetMovements([])
      setAssetHistoryLoading(false)
      setAssetEvidence([])
      setAssetEvidenceLoading(false)
      setEvidenceForm({ movementId: '', docType: 'ACTA', note: '', file: null })
      return
    }
    loadAssetMovements(safeAssetId)
    loadAssetEvidence(safeAssetId)
  })

  useEffect(() => {
    handleActiveTabDataLoad()
  }, [activeTab, importsView, isAuthed, isCentral, currentUser?.institutionId, currentUser?.establishmentId])

  useEffect(() => {
    handleInstitutionCatalogTabLoad()
  }, [isAuthed, activeTab, isCentral])

  useEffect(() => {
    handleEstablishmentCatalogLoad()
  }, [isAuthed, estForm.institutionId, activeTab])

  useEffect(() => {
    handleDependencyCatalogLoad()
  }, [isAuthed, depForm.establishmentId, activeTab])

  useEffect(() => {
    handleAssetEstablishmentsLoad()
  }, [isAuthed, assetInstitutionId, activeTab])

  useEffect(() => {
    handleAssetDependenciesLoad()
  }, [isAuthed, assetForm.establishmentId, activeTab])

  useEffect(() => {
    handleAssetListEstablishmentsLoad()
  }, [isAuthed, activeTab, assetListFilters.institutionId])

  useEffect(() => {
    handleAssetListDependenciesLoad()
  }, [isAuthed, activeTab, assetListFilters.establishmentId])

  useEffect(() => {
    if (activeTab !== 'assets') {
      assetsBootstrapPromiseRef.current = null
      assetsBootstrapLastRunRef.current = 0
    }
  }, [activeTab])

  useEffect(() => {
    if (!isAuthed) return
    if (activeTab !== 'assets') return

    if (assetSearchDebounceRef.current) {
      clearTimeout(assetSearchDebounceRef.current)
    }
    assetSearchDebounceRef.current = setTimeout(() => {
      handleAssetsSearch()
    }, 320)

    return () => {
      if (assetSearchDebounceRef.current) {
        clearTimeout(assetSearchDebounceRef.current)
        assetSearchDebounceRef.current = null
      }
    }
  }, [
    isAuthed,
    activeTab,
    assetListFilters.id,
    assetListFilters.internalCode,
    assetListFilters.q,
    assetListFilters.responsibleName,
    assetListFilters.costCenter,
    assetListFilters.institutionId,
    assetListFilters.establishmentId,
    assetListFilters.dependencyId,
    assetListFilters.assetStateId,
    assetListFilters.includeDeleted,
    assetListFilters.fromDate,
    assetListFilters.toDate,
  ])

  useEffect(() => {
    restoreLastCreatedAsset()
  }, [isAuthed])

  useEffect(() => {
    return () => {
      if (assetSearchDebounceRef.current) {
        clearTimeout(assetSearchDebounceRef.current)
        assetSearchDebounceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    syncCreatedAssetDetails()
  }, [createdAsset?.id])

  useEffect(() => {
    setDepForm((prev) => ({ ...prev, establishmentId: '' }))
  }, [estForm.institutionId])

  const tabs = [
    { id: 'institutions', label: 'Instituciones' },
    { id: 'establishments', label: 'Establecimientos' },
    { id: 'dependencies', label: 'Sectores' },
    { id: 'users', label: 'Usuarios' },
    { id: 'assistant', label: 'Asistente Central' },
    { id: 'assets', label: UI_TEXT.assetPlural },
    { id: 'trash', label: 'Basurero' },
    { id: 'imports', label: 'Importaciones' },
    { id: 'planchetas', label: 'Planchetas' },
    { id: 'audit', label: 'Auditoría Administrativa' },
  ]
  const miniManualByTab = {
    institutions: {
      title: 'Instituciones',
      steps: [
        'Registrar la institución con su nombre oficial.',
        'Actualizar los datos y guardar los cambios.',
        'Dar de baja solo si no mantiene establecimientos activos.',
        'Usar "Mostrar inactivos" para reactivar cuando corresponda.',
      ],
    },
    establishments: {
      title: 'Establecimientos',
      steps: [
        'Seleccionar la institución y revisar la nómina de establecimientos.',
        'Completar tipo, RBD, comuna y antecedentes administrativos.',
        'Actualizar los datos y guardar.',
        'Dar de baja o reactivar respetando las reglas de sectores activos.',
      ],
    },
    dependencies: {
      title: 'Sectores',
      steps: [
        'Seleccionar el establecimiento antes de crear el sector.',
        'Verificar que el nombre identifique claramente sala, oficina o bodega.',
        'Usar la replicación de sectores base para copiar estructura a otro establecimiento.',
        'Actualizar los datos si cambia la estructura interna.',
        'Dar de baja solo cuando no existan activos vinculados.',
      ],
    },
    users: {
      title: 'Usuarios',
      steps: [
        'Crear cada usuario con el rol que corresponda.',
        'Asignar establecimiento cuando el rol lo requiera.',
        'Usar filtros y paginación para revisar cuentas activas e inactivas.',
        'Desactivar o reactivar sin perder trazabilidad.',
      ],
    },
    assistant: {
      title: 'Asistente Central',
      steps: [
        'Escribir una consulta operativa o técnica del sistema.',
        'Revisar la respuesta y las sugerencias aplicables.',
        'Crear una solicitud formal para seguimiento cuando corresponda.',
        'Gestionar estados y SLA de 72 horas desde la misma vista.',
      ],
    },
    assets: {
      title: UI_TEXT.assetPlural,
      steps: [
        'Seleccionar institución, establecimiento y sector.',
        'Elegir catálogo o ingresar los datos del activo de forma manual.',
        'Definir cantidad, valor, fecha y responsable, si corresponde.',
        'Crear el activo y luego gestionar movimiento, transferencia o baja desde el modal.',
      ],
    },
    trash: {
      title: 'Basurero',
      steps: [
        'Revisar los activos dados de baja.',
        'Filtrar por fechas y texto para localizar registros.',
        'Usar la restauración con motivo cuando corresponda.',
      ],
    },
    imports: {
      title: 'Importaciones',
      steps: [
        'Seleccionar subtipo: Activos fijos, Catálogo estándar o Catálogo base SN.',
        'Cargar el archivo Excel en el formato correspondiente.',
        'Revisar el resumen de creados, omitidos y errores.',
        'Corregir y reimportar cuando existan filas con error.',
      ],
    },
    planchetas: {
      steps: [
        'Seleccionar institución y establecimiento.',
        'Opcionalmente filtrar por sector y rango de fechas.',
        'Previsualizar los resultados y validar los conteos.',
        'Exportar a PDF o Excel para uso administrativo.',
      ],
    },
    audit: {
      title: 'Auditoría administrativa',
      steps: [
        'Filtrar por entidad, acción, usuario y rango de fechas.',
        'Revisar la trazabilidad de cambios críticos.',
        'Exportar reportes cuando se requiera respaldo.',
        'Aplicar limpieza de auditoría solo con criterio administrativo.',
      ],
    },
  }
  const activeMiniManual = miniManualByTab[activeTab]
  const modalCatalogItem = selectedCatalogItem || createdAsset?.catalogItem || null
  const assetEvidenceMovements = assetMovements.filter(
    (m) =>
      m.type === 'TRANSFER' ||
      m.type === 'RELOCATION' ||
      m.type === 'STATUS_CHANGE' ||
      m.type === 'INVENTORY_CHECK'
  )
  const multiProductsTotalQuantity = assetMultiProducts.reduce((acc, row) => {
    const qty = Number(row?.quantity)
    if (!Number.isInteger(qty) || qty <= 0) return acc
    return acc + qty
  }, 0)
  const selectedAssetInstitution = institutionsCatalog.find(
    (inst) => String(inst.id) === String(assetInstitutionId)
  )
  const selectedAssetEstablishment = assetEstablishments.find(
    (est) => String(est.id) === String(assetForm.establishmentId)
  )
  const trashWithDateCount = trashAssets.filter((asset) => asset.deletedAt).length
  const trashWithDependencyCount = trashAssets.filter((asset) => asset.dependency?.name).length

  if (showIntro) {
    return (
      <div className="intro-screen" role="dialog" aria-label="Introduccion de bienvenida">
        <video
          ref={introVideoRef}
          className="intro-video"
          src={INTRO_VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={closeIntro}
          onError={closeIntro}
        />
        <div className="intro-overlay">
          <div className="intro-copy">
            <span>Inventario</span>
            <h2>Bienvenido al panel</h2>
            <p>Al terminar la introduccion entraras automaticamente al sistema.</p>
          </div>
          <button type="button" className="ghost intro-skip" onClick={closeIntro}>
            Saltar introduccion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <AssetCatalogModal
        {...{
          isOpen: catalogModalOpen,
          onClose: () => setCatalogModalOpen(false),
          modalCatalogItem,
          createdAsset,
          createdLabel,
          qrCodeUrl,
          status,
          copyStatusDetailsJson,
          copyTechnicalSheetLink,
          openPrintLabel,
          downloadLabelPdf,
          openCatalogAction,
          isCentral,
          catalogAction,
          setCatalogAction,
          editAssetForm,
          setEditAssetForm,
          editAssetHasResponsible,
          setEditAssetHasResponsible,
          normalizeRutValue,
          normalizeCostCenterValue,
          submitEditAsset,
          moveAssetForm,
          setMoveAssetForm,
          assetDependencies,
          submitMoveAsset,
          transferAssetForm,
          setTransferAssetForm,
          transferEstablishments,
          transferDependencies,
          loadTransferDependenciesForEstablishment,
          setErr,
          movementReasonCodes,
          submitTransferAsset,
          statusAssetForm,
          setStatusAssetForm,
          assetStates,
          submitStatusAsset,
          assetEvidenceMovements,
          evidenceForm,
          setEvidenceForm,
          prepareEvidenceDocType,
          submitEvidenceUpload,
          assetEvidenceLoading,
          assetEvidence,
          downloadEvidence,
          assetHistoryLoading,
          assetMovements,
          getMovementTitle,
          getMovementRouteLabel,
          getMovementReasonLabel,
          isActaEligibleMovement,
          openMovementActa,
          prepareEvidenceForMovement,
        }}
      />
      <div className="hero">
        <div className="hero-top">
          <div className="hero-title">
            <div className="hero-logos">
              <img
                className="hero-logo hero-logo-subsecretaria"
                src={logoSubsecretaria}
                alt="Logo Subsecretaría de la Niñez"
              />
            </div>
            <div className="hero-heading">
              <span>Inventario</span>
              <h1>Panel Administrativo</h1>
            </div>
          </div>
          {isAuthed && (
            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={toggleUserMenu}
                aria-expanded={isUserMenuOpen}
              >
                <div className="user-thumb-wrap">
                  {currentUser?.photoDataUrl ? (
                    <img
                      className="user-thumb"
                      src={currentUser.photoDataUrl}
                      alt={`Foto ${currentUser?.name || 'Usuario'}`}
                    />
                  ) : (
                    <div className="user-thumb user-thumb-empty">Sin foto</div>
                  )}
                </div>
                <span className="user-menu-section">{UI_TEXT.session}</span>
                <span className="user-menu-name">{currentUser?.name || 'Usuario'}</span>
                <span className="user-menu-role">{roleType || 'ADMIN'}</span>
                <span className="user-menu-caret">{isUserMenuOpen ? 'Ocultar' : 'Abrir'}</span>
              </button>
              {isUserMenuOpen && (
                <div className="user-menu-panel">
                  <p className="muted">{currentUser?.email || ''}</p>
                  {!isChangePasswordOpen ? (
                    <button type="button" className="ghost" onClick={openChangePassword}>
                      Cambiar clave
                    </button>
                  ) : (
                    <form onSubmit={handleChangePassword} className="auth-form" style={{ marginBottom: 8 }}>
                      <div className="field">
                        <label>Clave actual</label>
                        <input
                          type="password"
                          value={changePasswordForm.currentPassword}
                          onChange={(e) =>
                            setChangePasswordForm((prev) => ({
                              ...prev,
                              currentPassword: e.target.value,
                            }))
                          }
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="field">
                        <label>Nueva clave</label>
                        <input
                          type="password"
                          value={changePasswordForm.newPassword}
                          onChange={(e) =>
                            setChangePasswordForm((prev) => ({
                              ...prev,
                              newPassword: e.target.value,
                            }))
                          }
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="field">
                        <label>Confirmar nueva clave</label>
                        <input
                          type="password"
                          value={changePasswordForm.confirmPassword}
                          onChange={(e) =>
                            setChangePasswordForm((prev) => ({
                              ...prev,
                              confirmPassword: e.target.value,
                            }))
                          }
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="actions">
                        <button type="button" className="ghost" onClick={closeChangePassword}>
                          Cancelar
                        </button>
                        <button type="submit" className="primary" disabled={isChangingPassword}>
                          {isChangingPassword ? UI_TEXT.saving : UI_TEXT.saveKey}
                        </button>
                      </div>
                    </form>
                  )}
                  <button type="button" className="ghost" onClick={handleLogout}>
                    {UI_TEXT.closeSession}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {showHeroNotice && (
          <div className="hero-notice">
            Gestión institucional del inventario con trazabilidad, control operativo y
            seguimiento de cada movimiento.
          </div>
        )}
      </div>

      {(!isAuthed || status.message) && (
      <section className={!isAuthed ? 'card auth-card' : 'card'}>
        {!isAuthed ? (
          <>
            <div>
              <h2>Acceso al sistema</h2>
              <p className="muted">Plataforma institucional para la gestión y trazabilidad del inventario</p>
            </div>
            <form onSubmit={handleLogin} className="auth-form" autoComplete="off">
              <div className="field">
                <label>Correo</label>
                <input
                  type="email"
                  value={login.email}
                  onChange={(e) => setLogin({ ...login, email: e.target.value })}
                  placeholder="correo@institucion.cl"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={login.password}
                  onChange={(e) => setLogin({ ...login, password: e.target.value })}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="off"
                />
              </div>
              <div className="auth-actions">
                <button type="submit" className="primary" disabled={isLoginLoading}>
                  {isLoginLoading ? (
                    <span className="btn-loading">
                      <span className="btn-spinner" aria-hidden="true" />
                      Iniciando sesión...
                    </span>
                  ) : (
                    'Iniciar sesión'
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <></>
        )}
        {status.message && (
          <div className={'status ' + status.type}>
            <div>{status.message}</div>
            {status.type === 'error' && isAuthed && (
              <details className="status-meta">
                <summary>Detalle tecnico</summary>
                <div className="status-meta-grid">
                  <div>
                    <strong>Code:</strong> <span>{status.code || 'UNKNOWN_ERROR'}</span>
                  </div>
                  <div>
                    <strong>Request ID:</strong> <span>{status.requestId || 'N/A'}</span>
                    {status.requestId && (
                      <button
                        type="button"
                        className="ghost status-copy-btn"
                        onClick={copyStatusRequestId}
                      >
                        Copiar ID
                      </button>
                    )}
                    {status.details && (
                      <button
                        type="button"
                        className="ghost status-copy-btn"
                        onClick={copyStatusDetailsJson}
                      >
                        Copiar detalle JSON
                      </button>
                    )}
                  </div>
                </div>
                {statusCopyFeedback && <div className="muted">{statusCopyFeedback}</div>}
                {status.details && (
                  <pre className="code-block">{JSON.stringify(status.details, null, 2)}</pre>
                )}
              </details>
            )}
          </div>
        )}
      </section>
      )}

      <section className="card">
        <div className="tabs">
          {tabs
            .filter(
              (tab) =>
                !((tab.id === 'users' || tab.id === 'assistant') && !isCentral)
            )
            .map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.id)}
              disabled={!isAuthed}
            >
              {tab.label}
            </button>
          ))}
          <button className="ghost" onClick={resetPreferences}>
            Reset preferencias
          </button>
        </div>

        {!isAuthed ? (
          <div className="empty-state">Inicia sesión para continuar.</div>
        ) : null}
        {isAuthed && activeMiniManual ? (
          <details className="mini-manual">
            <summary>Mini manual: {activeMiniManual.title}</summary>
            <ol>
              {activeMiniManual.steps.map((step, idx) => (
                <li key={`${activeTab}-manual-${idx}`}>{step}</li>
              ))}
            </ol>
          </details>
        ) : null}

        {isAuthed && activeTab === 'institutions' && (
          <InstitutionsAdminSection
            {...{
              isCentral,
              instQuery,
              setInstQuery,
              instIncludeInactive,
              setInstIncludeInactive,
              loadInstitutions,
              downloadFile,
              dangerZoneUnlocked,
              lockDangerZoneButtons,
              unlockDangerZoneButtons,
              dangerZoneUnlocking,
              instForm,
              setInstForm,
              formErrors,
              setFormErrors,
              createInstitution,
              institutions,
              institutionsCatalog,
              instSort,
              setInstSort,
              instTotal,
              instPage,
              setInstPage,
              setInstitutions,
              instOriginal,
              updateInstitution,
              deleteInstitution,
              reactivateInstitution,
              hardDeleteInstitution,
              openForceDelete,
            }}
          />
        )}

        {isAuthed && activeTab === 'establishments' && isCentral && (
          <EstablishmentsAdminSection
            {...{
              estFilters,
              setEstFilters,
              estIncludeInactive,
              setEstIncludeInactive,
              loadEstablishments,
              downloadFile,
              estForm,
              setEstForm,
              formErrors,
              institutionsCatalog,
              loadingInstitutions,
              establishmentsCatalog,
              createEstablishment,
              establishments,
              estSort,
              setEstSort,
              estTotal,
              estPage,
              setEstPage,
              setEstablishments,
              estOriginal,
              updateEstablishment,
              deleteEstablishment,
              reactivateEstablishment,
              hardDeleteEstablishment,
              openForceDelete,
            }}
          />
        )}

        {isAuthed && activeTab === 'dependencies' && isCentral && (
          <DependenciesAdminSection
            {...{
              depFilters,
              setDepFilters,
              depIncludeInactive,
              setDepIncludeInactive,
              loadDependencies,
              downloadFile,
              establishmentsCatalog,
              depForm,
              setDepForm,
              formErrors,
              loadingEstablishments,
              createDependency,
              depReplicateForm,
              setDepReplicateForm,
              replicateDependenciesFromBase,
              depReplicateResult,
              depSort,
              setDepSort,
              dependencies,
              depTotal,
              depPage,
              setDepPage,
              setDependencies,
              depOriginal,
              updateDependency,
              deleteDependency,
              reactivateDependency,
              hardDeleteDependency,
              openForceDelete,
            }}
          />
        )}

        {isAuthed && activeTab === 'users' && isCentral && (
          <UsersAdminSection
            {...{
              userFilters,
              setUserFilters,
              loadUsersAdmin,
              userForm,
              setUserForm,
              userInstitutionOptions,
              userEstablishmentOptions,
              userFormWithoutPhoto,
              setUserFormWithoutPhoto,
              setUserFormPhotoFile,
              createUserAdmin,
              users,
              usersTotal,
              usersLoading,
              usersPage,
              setUsersPage,
              setUsers,
              usersOriginal,
              currentUser,
              userPhotoFiles,
              setUserPhotoFiles,
              saveUserPhotoAdmin,
              clearUserPhotoAdmin,
              updateUserAdmin,
              resetUserPasswordAdmin,
              deactivateUserAdmin,
              reactivateUserAdmin,
              openForceDelete,
              setErr,
            }}
          />
        )}

        {isAuthed && activeTab === 'assistant' && isCentral && (
          <AssistantCentralSection
            {...{
              loadSupportRequests,
              testAssistantSmtp,
              assistantSmtpLoading,
              assistantQuestion,
              setAssistantQuestion,
              assistantScope,
              setAssistantScope,
              institutionsCatalog,
              establishmentsCatalog,
              dependenciesCatalog,
              assistantNotifyEmail,
              setAssistantNotifyEmail,
              askCentralAssistant,
              assistantLoading,
              assistantAnswer,
              createSupportRequestFromAssistant,
              supportFilters,
              setSupportFilters,
              supportRequests,
              supportTotal,
              supportLoading,
              supportPage,
              setSupportPage,
              updateSupportStatus,
              supportCommentDraft,
              setSupportCommentDraft,
              sendSupportComment,
            }}
          />
        )}

        {isAuthed && activeTab === 'assets' && (
          <AssetsTabPanel>
          <AssetsSection>
            <DepreciationCloseView
              {...{
                isCentral,
                depreciationCloseForm,
                setDepreciationCloseForm,
                depreciationRuns,
                depreciationRunsLoading,
                depreciationClosing,
                onRefreshRuns: loadDepreciationRuns,
                onCloseRun: submitDepreciationClose,
              }}
            />
            <AssetsCreateView
              {...{
                assetInstitutionId,
                setAssetInstitutionId,
                setAssetEstablishments,
                setAssetDependencies,
                setAssetForm,
                loadAssetEstablishments,
                institutionsCatalog,
                selectedAssetInstitution,
                assetForm,
                assetEstablishments,
                loadAssetDependencies,
                selectedAssetEstablishment,
                assetErrors,
                assetDependencies,
                assetStates,
                assetTypes,
                assetMultiProductEnabled,
                handleSelectCatalogItem,
                assetCatalogItems,
                formatCatalogItemDisplay,
                resizeMultiProducts,
                assetMultiProductCount,
                setSelectedCatalogItem,
                setAssetMultiProductEnabled,
                assetMultiProducts,
                updateMultiProductRow,
                multiProductsTotalQuantity,
                assetHasResponsible,
                setAssetHasResponsible,
                normalizeRutValue,
                normalizeCostCenterValue,
                calculateStraightLineDepreciation,
                handleCreateAsset,
                assetCreating,
                setCreatedAsset,
                setCreatedAssetBatch,
                setAssetMultiProductCount,
                setAssetMultiProducts,
                setQrCodeUrl,
                scanInput,
                setScanInput,
                resolveScannedAsset,
                setScanResult,
                scanResult,
                createdAsset,
                labelData,
                labelAssetId,
                setLabelAssetId,
                assetsList,
                toPositiveIntOrNull,
                openPrintLabel,
                createdAssetBatch,
                openPrintBatchLabels,
                qrCodeUrl,
              }}
            />

            <AssetsListView
              {...{
                showAssetCatalogList,
                setShowAssetCatalogList,
                assetCatalogItems,
                applyCatalogItem,
                formatCatalogItemDisplay,
                assetsLoading,
                assetsList,
                assetListFilters,
                setAssetListFilters,
                institutionsCatalog,
                assetListEstablishments,
                loadAssetListEstablishments,
                loadAssetListDependencies,
                assetListDependencies,
                assetStates,
                loadAssetsList,
                selectedAssetIds,
                toggleSelectedAsset,
                toggleSelectAllVisibleAssets,
                clearSelectedAssets,
                openPrintSelectedAssetQrLabels,
                openPrintSelectedAssetBarcodeLabels,
                openPrintAssetListQrLabels,
                openPrintAssetListBarcodeLabels,
                openPrintBlankBarcodeSequence,
                toPositiveIntOrNull,
                downloadFile,
                assetListPage,
                assetListTotal,
                selectAssetForModal,
                isCentral,
              }}
            />
          </AssetsSection>
          </AssetsTabPanel>
        )}

        {isAuthed && activeTab === 'trash' && (
          <TrashTabPanel>
          <div className="section module-section module-section-trash">
            <div className="section-head">
              <h3>Basurero</h3>
              <div className="actions">
                <input
                  placeholder="Buscar..."
                  value={trashFilters.q}
                  onChange={(e) => setTrashFilters((p) => ({ ...p, q: e.target.value }))}
                />
                <input
                  placeholder="Codigo interno"
                  value={trashFilters.internalCode}
                  onChange={(e) =>
                    setTrashFilters((p) => ({ ...p, internalCode: e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={trashFilters.deletedFrom}
                  onChange={(e) =>
                    setTrashFilters((p) => ({ ...p, deletedFrom: e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={trashFilters.deletedTo}
                  onChange={(e) =>
                    setTrashFilters((p) => ({ ...p, deletedTo: e.target.value }))
                  }
                />
                <button className="ghost" onClick={loadTrash}>
                  {UI_TEXT.updating}
                </button>
              </div>
            </div>
            <div className="table">
              <div className="table-head">
                <span className="muted">
                  {trashLoading ? UI_TEXT.loading : `Mostrando ${trashAssets.length}`}
                </span>
              </div>
              {trashAssets.map((asset, idx) => (
                <div key={asset.id} className="row">
                  <div className="row-main">
                    <strong>#{idx + 1}</strong>
                    <span className="pill">ID real: {asset.id}</span>
                    <span className="pill danger-pill">BAJA</span>
                    <span className="pill">INV-{asset.internalCode}</span>
                    <span>{asset.name}</span>
                    {asset.deletedAt && (
                      <span className="muted">
                        Baja: {String(asset.deletedAt).slice(0, 10)}
                      </span>
                    )}
                  </div>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => restoreFromTrash(asset)}>
                      Restaurar
                    </button>
                    <button
                      className="danger danger-outline"
                      onClick={() =>
                        openForceDelete('asset', asset.id, `${asset.name || 'Activo'} (INV-${asset.internalCode})`)
                      }
                    >
                      Eliminar forzado
                    </button>
                  </div>
                </div>
              ))}
              {!trashAssets.length && !trashLoading && (
                <p className="muted">Basurero vacio.</p>
              )}
            </div>
          </div>
          </TrashTabPanel>
        )}

        {isAuthed && activeTab === 'imports' && (
          <ImportsTabPanel>
            <ImportsSection importsView={importsView} setImportsView={setImportsView}>

        {importsView === 'assets' && (
          <ImportsAssetsView
            {...{
              downloadFile,
              purgeAssetsAllWithReset: guardedPurgeAssetsAllWithReset,
              dangerZoneUnlocked,
              dangerZoneUnlocking,
              unlockDangerZoneButtons,
              lockDangerZoneButtons,
              setImportFile,
              handlePreviewFile,
              handleImportUpload,
              resumeImportJob,
              importLoading,
              importResult,
              importSchemaDetails,
              previewHeaders,
              previewMissing,
              previewRows,
              previewInvalidCells,
              importErrors,
              importHistoryFilters,
              setImportHistoryFilters,
              loadImportHistory,
              importHistoryLoading,
              importHistory,
              setImportHistoryOpen,
              importHistoryOpen,
              importHistoryPage,
              importHistoryTotal,
            }}
          />
        )}

        {importsView === 'catalog' && (
          <ImportsCatalogView
            {...{
              downloadFile,
              purgeCatalogAllWithReset: guardedPurgeCatalogAllWithReset,
              dangerZoneUnlocked,
              dangerZoneUnlocking,
              unlockDangerZoneButtons,
              lockDangerZoneButtons,
              setCatalogImportFile,
              handleCatalogImportUpload,
              catalogImportLoading,
              catalogImportResult,
              downloadCatalogImportReport,
              catalogImportErrors,
              catalogManualForm,
              setCatalogManualForm,
              setManualOfficialKeyCheck,
              checkManualOfficialKeyAvailability,
              handleCatalogManualCreate,
              manualOfficialKeyCheck,
              catalogAdminQuery,
              setCatalogAdminQuery,
              loadCatalogAdminItems,
              catalogAdminLoading,
              catalogAdminItems,
              setCatalogAdminItems,
              catalogAdminOriginal,
              catalogAdminRowStatus,
              catalogAdminKeyStatus,
              catalogAdminPage,
              catalogAdminTotal,
              CATALOG_ADMIN_TAKE,
              scheduleCatalogAdminOfficialKeyValidation,
              updateCatalogAdminItem,
              discardCatalogAdminItem,
              openForceDelete,
            }}
          />
        )}

        {importsView === 'sn' && (
          <ImportsSnView
            {...{
              handleSnBaseFileChange,
              snBaseFile,
              snBaseParsed,
              snBaseImporting,
              handleSnBaseImportToCatalog,
              snBaseLoading,
              snBaseImportResult,
            }}
          />
        )}
            </ImportsSection>
          </ImportsTabPanel>
        )}

        {isAuthed && activeTab === 'planchetas' && (
          <PlanchetasTabPanel>
            <PlanchetasSection
              {...{
                canPreviewPlancheta,
                canExportPlancheta,
                loadPlanchetaPreview,
                downloadPlancheta,
                planchetaPreviewLoading,
                planchetaQuery,
                planchetaPreview,
                planchetaDirectory,
                planchetaFilters,
                planchetaInsights,
                setPlanchetaFilters,
                loadPlanchetaEstablishments,
                setPlanchetaEstablishments,
                setPlanchetaDependencies,
                loadingPlancheta,
                planchetaInstitutions,
                planchetaEstablishments,
                loadPlanchetaDependencies,
                planchetaDependencies,
                planchetaMessage,
                planchetaSummary,
                formatPlanchetaMovement,
                openPrintPlanchetaQrLabels,
                openPrintPlanchetaBarcodeLabels,
              }}
            />
          </PlanchetasTabPanel>
        )}
        {isAuthed && activeTab === 'audit' && (
          <AuditTabPanel>
            <AuditSection
              {...{
                auditFilters,
                setAuditFilters,
                applyAuditRangePreset,
                loadAdminAudits,
                resetAdminAuditFilters,
                buildAdminAuditParams,
                downloadFile,
                adminAuditLoading,
                adminAudits,
                adminAuditTotal,
                adminAuditPage,
                auditCleanupForm,
                setAuditCleanupForm,
                runAuditCleanup,
                loginAuditFilters,
                setLoginAuditFilters,
                loadLoginAudits,
                resetLoginAuditFilters,
                buildLoginAuditParams,
                loginAuditLoading,
                loginAudits,
                loginAuditTotal,
                loginAuditPage,
                metricsFilters,
                setMetricsFilters,
                loadLoginMetrics,
                metricsTop,
                setMetricsTop,
                loginMetrics,
                loginMetricsHourly,
                hourlySort,
                setHourlySort,
                loginMetricsByIp,
                ipSort,
                setIpSort,
                loginMetricsByUser,
                userSort,
                setUserSort,
              }}
            />
          </AuditTabPanel>
        )}
      </section>

      {restoreModal.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Restaurar activo fijo</h3>
            <p>
              Selecciona motivo para restaurar
              {restoreModal.asset ? `: ${restoreModal.asset.name}` : ''}.
            </p>
            <select
              value={restoreModal.reasonCode}
              onChange={(e) =>
                setRestoreModal((prev) => ({
                  ...prev,
                  reasonCode: e.target.value,
                }))
              }
            >
              <option value="">Selecciona motivo</option>
              {(movementReasonCodes.restore || []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={restoreModal.docType}
              onChange={(e) =>
                setRestoreModal((prev) => ({
                  ...prev,
                  docType: e.target.value,
                }))
              }
            >
              <option value="FOTO">FOTO</option>
              <option value="ACTA">ACTA</option>
              <option value="FACTURA">FACTURA</option>
              <option value="OTRO">OTRO</option>
            </select>
            <input
              value={restoreModal.note}
              onChange={(e) =>
                setRestoreModal((prev) => ({
                  ...prev,
                  note: e.target.value,
                }))
              }
              placeholder="Nota evidencia (opcional)"
            />
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) =>
                setRestoreModal((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] || null,
                }))
              }
            />
            <div className="modal-actions">
              <button
                className="ghost"
                onClick={() =>
                  setRestoreModal({
                    open: false,
                    asset: null,
                    reasonCode: '',
                    docType: 'ACTA',
                    note: '',
                    file: null,
                  })
                }
              >
                Cancelar
              </button>
              <button className="primary" onClick={confirmRestoreFromTrash}>
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <div className="modal-actions">
              <button className="ghost" onClick={closeConfirm}>
                Cancelar
              </button>
              <button
                className="danger"
                onClick={() => confirmState.onConfirm && confirmState.onConfirm()}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteBlockState.open && (
        <div className="modal-backdrop modal-backdrop-scroll">
          <div className="modal">
            <h3>{deleteBlockState.title}</h3>
            {deleteBlockState.summary && (
              <div className="modal-summary-grid">
                {Object.entries(deleteBlockState.summary).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}</strong>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
            {deleteBlockState.dependencies.length > 0 && (
              <>
                <p className="muted">Sectores bloqueantes:</p>
                <div className="rows">
                  {deleteBlockState.dependencies.map((dep) => (
                    <div key={`blocked-dep-${dep.id}`} className="row">
                      <div className="row-main">
                        <strong>#{dep.id}</strong>
                        <span>{dep.name || 'Sin nombre'}</span>
                        <span className="pill">Activos vigentes: {Number(dep.activeAssets || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="primary" onClick={closeDeleteBlockModal}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {dangerZoneUnlockModalOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-danger-access">
            <h3>Habilitar acciones críticas</h3>
            <p className="muted">
              Este acceso está reservado para personal autorizado del programa.
            </p>
            <form onSubmit={submitDangerZoneUnlock} className="danger-access-form">
              <label>
                Contraseña de acceso
                <input
                  type="password"
                  value={dangerZoneUnlockInput}
                  onChange={(e) => {
                    setDangerZoneUnlockInput(e.target.value)
                    if (dangerZoneUnlockError) setDangerZoneUnlockError('')
                  }}
                  autoFocus
                  placeholder="Ingresa la contraseña"
                />
              </label>
              {dangerZoneUnlockError && <p className="error">{dangerZoneUnlockError}</p>}
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={closeDangerZoneUnlockModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary" disabled={dangerZoneUnlocking}>
                  {dangerZoneUnlocking ? 'Verificando...' : 'Habilitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loginErrorModal.open && !isAuthed && (
        <div
          className="modal-backdrop"
          onClick={() => setLoginErrorModal((prev) => ({ ...prev, open: false }))}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{loginErrorModal.title}</h3>
            <p>{loginErrorModal.message}</p>
            <div className="modal-actions">
              <button
                className="primary"
                onClick={() => setLoginErrorModal((prev) => ({ ...prev, open: false }))}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {forceDeleteState.open && (
        <div className="modal-backdrop modal-backdrop-scroll">
          <div className="modal modal-force-delete">
            <h3>Eliminación forzada</h3>
            <p>
              Esta acción elimina de forma permanente <strong>{forceDeleteState.entityLabel}</strong> y
              sus registros relacionados.
            </p>
            {forceDeleteState.loading ? (
              <p className="muted">Cargando resumen...</p>
            ) : (
              <>
                <div className="modal-summary-grid">
                  {Object.entries(forceDeleteState.summary || {})
                    .filter(([key]) => key !== 'confirmationText')
                    .map(([key, value]) => (
                    <div key={key}>
                      <strong>{key}</strong>
                      <span>{String(value)}</span>
                    </div>
                    ))}
                </div>
                {Array.isArray(forceDeleteState.details?.dependencies) &&
                  forceDeleteState.details.dependencies.length > 0 && (
                    <>
                      <p className="muted">Sectores y relaciones asociadas:</p>
                      <div className="rows">
                        {forceDeleteState.details.dependencies.map((dep) => (
                          <div key={`fd-dep-${dep.id}`} className="row">
                            <div className="row-main">
                              <strong>#{dep.id}</strong>
                              <span>{dep.name || 'Sin nombre'}</span>
                              {!dep.isActive && <span className="pill danger-pill">INACTIVA</span>}
                              <span className="pill">Activos: {Number(dep.assets || 0)}</span>
                              <span className="pill">
                                Solicitudes soporte: {Number(dep.supportRequests || 0)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                <label className="modal-confirm-label">
                  Escribe <strong>{forceDeleteState.expectedConfirmationText}</strong> para confirmar:
                  <input
                    value={forceDeleteState.confirmationText}
                    onChange={(e) =>
                      setForceDeleteState((prev) => ({
                        ...prev,
                        confirmationText: e.target.value,
                      }))
                    }
                    placeholder={forceDeleteState.expectedConfirmationText}
                  />
                </label>
              </>
            )}
            <div className="modal-actions">
              <button className="ghost" onClick={closeForceDelete} disabled={forceDeleteState.deleting}>
                Cancelar
              </button>
              <button
                className="danger"
                disabled={forceDeleteState.loading || forceDeleteState.deleting}
                onClick={confirmForceDelete}
              >
                {forceDeleteState.deleting ? 'Eliminando...' : 'Eliminar forzado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App















