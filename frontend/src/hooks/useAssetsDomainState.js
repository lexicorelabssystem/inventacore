import { useState } from 'react'

function useAssetsDomainState() {
  const [assetForm, setAssetForm] = useState({
    catalogItemId: '',
    name: '',
    quantity: '1',
    brand: '',
    modelName: '',
    serialNumber: '',
    accountingAccount: '',
    analyticCode: '',
    responsibleName: '',
    responsibleRut: '',
    responsibleRole: '',
    costCenter: '',
    acquisitionValue: '',
    acquisitionDate: '',
    depreciationMethod: 'LINEAL',
    usefulLifeYears: '',
    residualValue: '',
    depreciationStartDate: '',
    establishmentId: '',
    dependencyId: '',
    assetStateId: '',
    assetTypeId: '',
  })
  const [assetCatalogItems, setAssetCatalogItems] = useState([])
  const [showAssetCatalogList, setShowAssetCatalogList] = useState(false)
  const [assetStates, setAssetStates] = useState([])
  const [assetTypes, setAssetTypes] = useState([])
  const [assetEstablishments, setAssetEstablishments] = useState([])
  const [assetDependencies, setAssetDependencies] = useState([])
  const [assetListEstablishments, setAssetListEstablishments] = useState([])
  const [assetListDependencies, setAssetListDependencies] = useState([])
  const [assetInstitutionId, setAssetInstitutionId] = useState('')
  const [catalogFilters] = useState({
    q: '',
    category: '',
    subcategory: '',
    brand: '',
    modelName: '',
  })
  const [assetCreating, setAssetCreating] = useState(false)
  const [assetHasResponsible, setAssetHasResponsible] = useState(true)
  const [createdAsset, setCreatedAsset] = useState(null)
  const [createdAssetBatch, setCreatedAssetBatch] = useState([])
  const [assetMultiProductEnabled, setAssetMultiProductEnabled] = useState(false)
  const [assetMultiProductCount, setAssetMultiProductCount] = useState('2')
  const [assetMultiProducts, setAssetMultiProducts] = useState([
    { catalogItemId: '', quantity: '1', acquisitionValue: '' },
    { catalogItemId: '', quantity: '1', acquisitionValue: '' },
  ])
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [assetErrors, setAssetErrors] = useState({})
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [catalogAction, setCatalogAction] = useState(null)
  const [editAssetHasResponsible, setEditAssetHasResponsible] = useState(true)
  const [editAssetForm, setEditAssetForm] = useState({
    name: '',
    quantity: '',
    brand: '',
    modelName: '',
    serialNumber: '',
    accountingAccount: '',
    analyticCode: '',
    responsibleName: '',
    responsibleRut: '',
    responsibleRole: '',
    costCenter: '',
    acquisitionValue: '',
    acquisitionDate: '',
  })
  const [moveAssetForm, setMoveAssetForm] = useState({ toDependencyId: '' })
  const [transferAssetForm, setTransferAssetForm] = useState({
    toEstablishmentId: '',
    toDependencyId: '',
    reasonCode: '',
    docType: 'ACTA',
    note: '',
    file: null,
  })
  const [transferEstablishments, setTransferEstablishments] = useState([])
  const [transferDependencies, setTransferDependencies] = useState([])
  const [statusAssetForm, setStatusAssetForm] = useState({
    assetStateId: '',
    reasonCode: '',
    docType: 'ACTA',
    note: '',
    file: null,
  })
  const [movementReasonCodes, setMovementReasonCodes] = useState({
    transfer: [],
    statusChange: [],
    restore: [],
  })
  const [assetMovements, setAssetMovements] = useState([])
  const [assetHistoryLoading, setAssetHistoryLoading] = useState(false)
  const [assetEvidence, setAssetEvidence] = useState([])
  const [assetEvidenceLoading, setAssetEvidenceLoading] = useState(false)
  const [depreciationCloseForm, setDepreciationCloseForm] = useState({
    fiscalYear: String(new Date().getFullYear()),
  })
  const [depreciationRuns, setDepreciationRuns] = useState([])
  const [depreciationRunsLoading, setDepreciationRunsLoading] = useState(false)
  const [depreciationClosing, setDepreciationClosing] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({
    movementId: '',
    docType: 'ACTA',
    note: '',
    file: null,
  })
  const [assetsList, setAssetsList] = useState([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [labelAssetId, setLabelAssetId] = useState('')
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [assetListFilters, setAssetListFilters] = useState({
    id: '',
    internalCode: '',
    q: '',
    responsibleName: '',
    costCenter: '',
    institutionId: '',
    establishmentId: '',
    dependencyId: '',
    assetStateId: '',
    includeDeleted: false,
    fromDate: '',
    toDate: '',
  })
  const [assetListPage, setAssetListPage] = useState(1)
  const [assetListTotal, setAssetListTotal] = useState(0)
  const [selectedAssetIds, setSelectedAssetIds] = useState([])
  const [trashFilters, setTrashFilters] = useState({
    q: '',
    internalCode: '',
    deletedFrom: '',
    deletedTo: '',
  })
  const [trashAssets, setTrashAssets] = useState([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [restoreModal, setRestoreModal] = useState({
    open: false,
    asset: null,
    reasonCode: '',
    docType: 'ACTA',
    note: '',
    file: null,
  })

  return {
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
  }
}

export default useAssetsDomainState
