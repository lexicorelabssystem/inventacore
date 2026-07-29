import { useState } from 'react'
import { createPortal } from 'react-dom'
import { UI_TEXT } from '../constants/uiText'

function AssetCatalogTable(props) {
  const {
    showAssetCatalogList,
    setShowAssetCatalogList,
    assetCatalogItems,
    applyCatalogItem,
    formatCatalogItemDisplay,
  } = props

  return (
    <div className="table">
      <div className="table-head">
        <h4>{UI_TEXT.catalogAvailable}</h4>
        <div className="actions">
          <span className="muted">Mostrando {assetCatalogItems.length}</span>
          <button
            className="ghost"
            type="button"
            onClick={() => setShowAssetCatalogList((prev) => !prev)}
          >
            {showAssetCatalogList ? UI_TEXT.hideCatalog : UI_TEXT.showCatalog}
          </button>
        </div>
      </div>
      {showAssetCatalogList ? (
        <>
          {assetCatalogItems.map((item) => (
            <div key={item.id} className="row clickable" onClick={() => applyCatalogItem(item)}>
              <div>
                <strong>{formatCatalogItemDisplay(item)}</strong>
                <span className="muted"> - {item.category}</span>
              </div>
              <div className="row-actions">
                <button className="ghost" onClick={() => applyCatalogItem(item)}>
                  Usar
                </button>
              </div>
            </div>
          ))}
          {!assetCatalogItems.length && <p className="muted">{`Sin ${UI_TEXT.itemPlural}.`}</p>}
        </>
      ) : (
        <p className="muted">{UI_TEXT.catalogHidden}</p>
      )}
    </div>
  )
}

function AssetRecordsTable(props) {
  const {
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
  } = props
  const visibleIds = assetsList
    .map((asset) => toPositiveIntOrNull(asset.id))
    .filter(Boolean)
  const selectedVisibleCount = visibleIds.filter((id) => selectedAssetIds.includes(id)).length
  const allVisibleSelected = Boolean(visibleIds.length) && selectedVisibleCount === visibleIds.length
  const [massPrintMode, setMassPrintMode] = useState('')
  const [massPrintScope, setMassPrintScope] = useState({ institutionId: '', establishmentId: '' })
  const [blankPrintOpen, setBlankPrintOpen] = useState(false)
  const [blankPrintResidenceCount, setBlankPrintResidenceCount] = useState('')
  const [blankPrintForm, setBlankPrintForm] = useState({
    startCode: '',
    residences: [],
  })

  function requestMassPrint(mode) {
    if (assetListFilters.institutionId && assetListFilters.establishmentId) {
      const print = mode === 'barcode' ? openPrintAssetListBarcodeLabels : openPrintAssetListQrLabels
      print()
      return
    }
    const institutionId = assetListFilters.institutionId || ''
    setMassPrintMode(mode)
    setMassPrintScope({ institutionId, establishmentId: '' })
    if (institutionId) loadAssetListEstablishments(institutionId)
  }

  function closeMassPrintModal() {
    setMassPrintMode('')
    setMassPrintScope({ institutionId: '', establishmentId: '' })
  }

  async function confirmMassPrint() {
    if (!massPrintScope.institutionId || !massPrintScope.establishmentId) return
    const print =
      massPrintMode === 'barcode' ? openPrintAssetListBarcodeLabels : openPrintAssetListQrLabels
    closeMassPrintModal()
    await print({
      institutionId: massPrintScope.institutionId,
      establishmentId: massPrintScope.establishmentId,
      dependencyId: '',
    })
  }
  function formatMauPreview(value) {
    const number = Number(value)
    if (!Number.isInteger(number) || number <= 0) return ''
    return `MAU${String(number).padStart(7, '0')}`
  }

  function resizeBlankResidences(countInput) {
    const count = Number(countInput)
    setBlankPrintResidenceCount(countInput)
    if (!Number.isInteger(count) || count <= 0 || count > 20) {
      setBlankPrintForm((previous) => ({ ...previous, residences: [] }))
      return
    }
    setBlankPrintForm((previous) => {
      const current = previous.residences || []
      const residences = Array.from({ length: count }, (_, index) => ({
        residenceName: current[index]?.residenceName || '',
        quantity: current[index]?.quantity || '',
      }))
      return { ...previous, residences }
    })
  }

  function updateBlankResidence(index, patch) {
    setBlankPrintForm((previous) => ({
      ...previous,
      residences: previous.residences.map((residence, residenceIndex) =>
        residenceIndex === index ? { ...residence, ...patch } : residence
      ),
    }))
  }

  const hasBlankStartCodeInput = blankPrintForm.startCode !== ''
  const blankStartCode = Number(blankPrintForm.startCode)
  const blankResidenceCount = Number(blankPrintResidenceCount)
  const blankResidences = blankPrintForm.residences.map((residence) => ({
    residenceName: residence.residenceName.replace(/\s+/g, ' ').trim(),
    quantity: Number(residence.quantity),
  }))
  const blankTotalQuantity = blankResidences.reduce(
    (sum, residence) => sum + (Number.isInteger(residence.quantity) ? residence.quantity : 0),
    0
  )
  const blankFirstCode = blankStartCode
  const blankLastCode = blankStartCode + blankTotalQuantity - 1
  const hasValidResidenceRows =
    Number.isInteger(blankResidenceCount) &&
    blankResidenceCount > 0 &&
    blankResidenceCount <= 20 &&
    blankResidences.length === blankResidenceCount &&
    blankResidences.every(
      (residence) =>
        residence.residenceName && Number.isInteger(residence.quantity) && residence.quantity > 0
    )
  const canPrintBlankLabels =
    hasBlankStartCodeInput &&
    Number.isInteger(blankStartCode) &&
    blankStartCode > 0 &&
    hasValidResidenceRows &&
    blankTotalQuantity > 0 &&
    blankTotalQuantity <= 1000 &&
    blankLastCode <= 9999999

  function getBlankResidenceRange(index) {
    if (!hasBlankStartCodeInput || !Number.isInteger(blankStartCode) || blankStartCode <= 0) return null
    let start = blankStartCode
    for (let cursor = 0; cursor < index; cursor += 1) {
      const quantity = Number(blankPrintForm.residences[cursor]?.quantity)
      if (!Number.isInteger(quantity) || quantity <= 0) return null
      start += quantity
    }
    const quantity = Number(blankPrintForm.residences[index]?.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) return null
    return { start, end: start + quantity - 1 }
  }

  async function confirmBlankPrint() {
    if (!canPrintBlankLabels) return
    setBlankPrintOpen(false)
    await openPrintBlankBarcodeSequence(blankPrintForm.startCode, blankResidences)
  }
  return (
    <div className="table">
      <div className="table-head">
        <h4>Activos fijos creados</h4>
        <span className="muted">
          {assetsLoading ? UI_TEXT.loading : `Mostrando ${assetsList.length} de ${assetListTotal}`}
        </span>
      </div>
      <div className="row">
        <div className="actions">
          <input
            placeholder="ID"
            value={assetListFilters.id}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '')
              setAssetListFilters((p) => ({ ...p, id: digitsOnly }))
            }}
            className="inline-input small"
          />
          <input
            placeholder={UI_TEXT.codeInternal}
            value={assetListFilters.internalCode}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, internalCode: e.target.value }))}
            className="inline-input small"
          />
          <input
            placeholder={`Buscar por ${UI_TEXT.code.toLowerCase()} o nombre...`}
            value={assetListFilters.q}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, q: e.target.value }))}
          />
          <input
            placeholder="Responsable"
            value={assetListFilters.responsibleName}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, responsibleName: e.target.value }))}
          />
          <input
            placeholder="Centro costo"
            value={assetListFilters.costCenter}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, costCenter: e.target.value }))}
          />
          <input
            type="date"
            value={assetListFilters.fromDate}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, fromDate: e.target.value }))}
          />
          <input
            type="date"
            value={assetListFilters.toDate}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, toDate: e.target.value }))}
          />
          <label className="inline-check">
            <input
              type="checkbox"
              checked={assetListFilters.includeDeleted}
              onChange={(e) =>
                setAssetListFilters((p) => ({
                  ...p,
                  includeDeleted: e.target.checked,
                }))
              }
            />
            Mostrar activos dados de baja
          </label>
          <select
            value={assetListFilters.institutionId}
            onChange={(e) => {
              const value = e.target.value
              setAssetListFilters((p) => ({
                ...p,
                institutionId: value,
                establishmentId: '',
                dependencyId: '',
              }))
            }}
          >
            <option value="">{UI_TEXT.institution}</option>
            {institutionsCatalog.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
          <select
            value={assetListFilters.establishmentId}
            onChange={(e) => {
              const value = e.target.value
              setAssetListFilters((p) => ({
                ...p,
                establishmentId: value,
                dependencyId: '',
              }))
              if (value) loadAssetListDependencies(value)
            }}
          >
            <option value="">Establecimiento</option>
            {assetListEstablishments.map((est) => (
              <option key={est.id} value={est.id}>
                {est.name}
              </option>
            ))}
          </select>
          <select
            value={assetListFilters.dependencyId}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, dependencyId: e.target.value }))}
            disabled={!assetListFilters.establishmentId}
          >
            <option value="">Sector</option>
            {assetListDependencies.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>
          <select
            value={assetListFilters.assetStateId}
            onChange={(e) => setAssetListFilters((p) => ({ ...p, assetStateId: e.target.value }))}
          >
            <option value="">Estado</option>
            {assetStates.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={loadAssetsList}>
            {UI_TEXT.updating}
          </button>
          <button
            className="ghost"
            onClick={() =>
              setAssetListFilters({
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
            }
          >
            {UI_TEXT.clear}
          </button>
          <div className="label-print-sections">
            <div className="label-print-card">
              <strong className="label-print-title">Etiquetas QR</strong>
              <div className="label-print-actions">
                <button
                  className="ghost"
                  disabled={assetsLoading}
                  onClick={() => requestMassPrint('qr')}
                >
                  Imprimir QR masivo
                </button>
                <button
                  className="ghost"
                  disabled={!selectedVisibleCount}
                  onClick={openPrintSelectedAssetQrLabels}
                >
                  Imprimir QR seleccionados
                </button>
              </div>
            </div>
            <div className="label-print-card">
              <strong className="label-print-title">Etiquetas Barra</strong>
              <div className="label-print-actions">
                <button
                  className="ghost"
                  disabled={assetsLoading}
                  onClick={() => requestMassPrint('barcode')}
                >
                  Imprimir barra masivo
                </button>
                <button
                  className="ghost"
                  disabled={!selectedVisibleCount}
                  onClick={openPrintSelectedAssetBarcodeLabels}
                >
                  Imprimir barra seleccionados
                </button>
              </div>
            </div>
            <div className="label-print-card">
              <strong className="label-print-title">Etiquetas MAU vacias</strong>
              <div className="label-print-actions">
                <button
                  className="ghost"
                  disabled={assetsLoading}
                  onClick={() => setBlankPrintOpen(true)}
                >
                  Crear secuencia MAU
                </button>
              </div>
            </div>
          </div>
          <button
            className="ghost"
            onClick={() => {
              const params = new URLSearchParams()
              const safeId = toPositiveIntOrNull(assetListFilters.id)
              if (safeId) params.set('id', String(safeId))
              if (assetListFilters.internalCode) params.set('internalCode', assetListFilters.internalCode)
              if (assetListFilters.q) params.set('q', assetListFilters.q)
              if (assetListFilters.responsibleName) params.set('responsibleName', assetListFilters.responsibleName)
              if (assetListFilters.costCenter) params.set('costCenter', assetListFilters.costCenter)
              if (assetListFilters.institutionId) params.set('institutionId', assetListFilters.institutionId)
              if (assetListFilters.establishmentId) params.set('establishmentId', assetListFilters.establishmentId)
              if (assetListFilters.dependencyId) params.set('dependencyId', assetListFilters.dependencyId)
              if (assetListFilters.assetStateId) params.set('assetStateId', assetListFilters.assetStateId)
              if (assetListFilters.includeDeleted) params.set('includeDeleted', 'true')
              if (assetListFilters.fromDate) params.set('fromDate', assetListFilters.fromDate)
              if (assetListFilters.toDate) params.set('toDate', assetListFilters.toDate)
              const qs = params.toString()
              downloadFile(`/assets/export/excel${qs ? `?${qs}` : ''}`, 'assets_filtrados.xlsx')
            }}
          >
            Exportar todo en Excel
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = new URLSearchParams()
              const safeId = toPositiveIntOrNull(assetListFilters.id)
              if (safeId) params.set('id', String(safeId))
              if (assetListFilters.internalCode) params.set('internalCode', assetListFilters.internalCode)
              if (assetListFilters.q) params.set('q', assetListFilters.q)
              if (assetListFilters.responsibleName) params.set('responsibleName', assetListFilters.responsibleName)
              if (assetListFilters.costCenter) params.set('costCenter', assetListFilters.costCenter)
              if (assetListFilters.institutionId) params.set('institutionId', assetListFilters.institutionId)
              if (assetListFilters.establishmentId) params.set('establishmentId', assetListFilters.establishmentId)
              if (assetListFilters.dependencyId) params.set('dependencyId', assetListFilters.dependencyId)
              if (assetListFilters.assetStateId) params.set('assetStateId', assetListFilters.assetStateId)
              if (assetListFilters.includeDeleted) params.set('includeDeleted', 'true')
              if (assetListFilters.fromDate) params.set('fromDate', assetListFilters.fromDate)
              if (assetListFilters.toDate) params.set('toDate', assetListFilters.toDate)
              const qs = params.toString()
              downloadFile(`/assets/export/pdf${qs ? `?${qs}` : ''}`, 'assets_filtrados.pdf')
            }}
          >
            Exportar todo en PDF
          </button>
        </div>
      </div>
      <p className="muted">
        Las exportaciones incluyen todos los activos filtrados, no solo los de esta página.
      </p>
      <div className="row">
        <div className="actions">
          <label className="inline-check">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisibleAssets}
              disabled={!visibleIds.length}
            />
            Seleccionar página visible
          </label>
          <span className="muted">Seleccionados en esta página: {selectedVisibleCount}</span>
          <button className="ghost" onClick={clearSelectedAssets} disabled={!selectedAssetIds.length}>
            Limpiar selección
          </button>
        </div>
      </div>

      {assetsList.map((asset, idx) => (
        <div key={asset.id} className="row">
          <div className="row-main">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={selectedAssetIds.includes(toPositiveIntOrNull(asset.id))}
                onChange={() => toggleSelectedAsset(asset.id)}
              />
              Sel.
            </label>
            <strong>#{(assetListPage - 1) * 20 + idx + 1}</strong>
            <span className="pill">ID real: {asset.id}</span>
            <span className="pill">INV-{asset.internalCode}</span>
            <span>{asset.name}</span>
            <span className="pill">Cant: {asset.quantity ?? 1}</span>
            {asset.assetState?.name && (
              <span
                className={
                  asset.isDeleted || asset.assetState.name === 'BAJA' ? 'pill danger-pill' : 'pill'
                }
              >
                {asset.assetState.name}
              </span>
            )}
            {asset.dependency?.name && <span className="pill">{asset.dependency.name}</span>}
            {asset.responsibleName && <span className="pill">Resp: {asset.responsibleName}</span>}
            {asset.responsibleRut && <span className="pill">RUT: {asset.responsibleRut}</span>}
            {asset.responsibleRole && <span className="pill">Cargo: {asset.responsibleRole}</span>}
            {asset.costCenter && <span className="pill">CC: {asset.costCenter}</span>}
          </div>
          <div className="row-actions">
            <button className="ghost" onClick={() => selectAssetForModal(asset)}>
              Ver
            </button>
            <button className="ghost" onClick={() => selectAssetForModal(asset, 'edit')}>
              Editar
            </button>
            <button className="ghost" onClick={() => selectAssetForModal(asset, 'move')}>
              Mover
            </button>
            <button
              className="ghost"
              disabled={!isCentral || asset.isDeleted || asset.assetState?.name === 'BAJA'}
              onClick={() => selectAssetForModal(asset, 'transfer')}
            >
              Transferir
            </button>
            <button
              className="danger"
              disabled={asset.isDeleted || asset.assetState?.name === 'BAJA'}
              title={
                asset.isDeleted || asset.assetState?.name === 'BAJA'
                  ? 'Este activo ya está en baja. Revísalo en Basurero para restaurar o eliminar forzado.'
                  : 'Dar de baja'
              }
              onClick={() => selectAssetForModal(asset, 'status')}
            >
              {asset.isDeleted || asset.assetState?.name === 'BAJA' ? 'Ya en baja' : 'Dar de baja'}
            </button>
          </div>
        </div>
      ))}

      {!assetsList.length && !assetsLoading && (
        <div className="row">
          <div>
            <strong>Sin activos fijos para los filtros actuales.</strong>
            <p className="muted">
              Limpia los filtros, importa una matriz desde Importaciones o usa la exportación masiva
              cuando ya existan registros.
            </p>
          </div>
        </div>
      )}

      <div className="pagination">
        <button
          className="ghost"
          disabled={assetListPage <= 1}
          onClick={() => loadAssetsList(assetListPage - 1)}
        >
          {UI_TEXT.previous}
        </button>
        <span className="muted">
          {UI_TEXT.page} {assetListPage} / {Math.max(1, Math.ceil(assetListTotal / 20))}
        </span>
        <button
          className="ghost"
          disabled={assetListPage >= Math.ceil(assetListTotal / 20)}
          onClick={() => loadAssetsList(assetListPage + 1)}
        >
          {UI_TEXT.next}
        </button>
      </div>

      {massPrintMode &&
        createPortal(
          <div className="modal-backdrop" onClick={closeMassPrintModal}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h4>Impresion masiva de etiquetas</h4>
              <button type="button" className="ghost" onClick={closeMassPrintModal}>
                Cerrar
              </button>
            </div>
            <div className="modal-body modal-form">
              <p className="muted">
                Selecciona la residencia o establecimiento cuyos activos deseas imprimir.
              </p>
              <label className="modal-label">
                <strong>Institucion</strong>
                <select
                  value={massPrintScope.institutionId}
                  onChange={(event) => {
                    const institutionId = event.target.value
                    setMassPrintScope({ institutionId, establishmentId: '' })
                    loadAssetListEstablishments(institutionId)
                  }}
                >
                  <option value="">Selecciona una institucion</option>
                  {institutionsCatalog.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal-label">
                <strong>Residencia / establecimiento</strong>
                <select
                  value={massPrintScope.establishmentId}
                  disabled={!massPrintScope.institutionId}
                  onChange={(event) =>
                    setMassPrintScope((previous) => ({
                      ...previous,
                      establishmentId: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecciona una residencia</option>
                  {assetListEstablishments.map((establishment) => (
                    <option key={establishment.id} value={establishment.id}>
                      {establishment.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={confirmMassPrint}
                  disabled={!massPrintScope.institutionId || !massPrintScope.establishmentId}
                >
                  Imprimir {massPrintMode === 'barcode' ? 'codigos de barra' : 'codigos QR'}
                </button>
                <button type="button" className="ghost" onClick={closeMassPrintModal}>
                  Cancelar
                </button>
              </div>
            </div>
            </div>
          </div>,
          document.body
        )}

      {blankPrintOpen &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setBlankPrintOpen(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <h4>Crear etiquetas MAU vacias</h4>
                <button type="button" className="ghost" onClick={() => setBlankPrintOpen(false)}>
                  Cerrar
                </button>
              </div>
              <div className="modal-body modal-form">
                <p className="muted">
                  Esto no guarda activos. Primero indica cuantas residencias son, luego el nombre y
                  cantidad de etiquetas para cada una. El MAU continua sin saltos entre residencias.
                </p>
                <label className="modal-label">
                  <strong>Cantidad de residencias</strong>
                  <input
                    inputMode="numeric"
                    value={blankPrintResidenceCount}
                    placeholder="Ej: 4"
                    onChange={(event) => resizeBlankResidences(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <label className="modal-label">
                  <strong>Primer MAU a imprimir</strong>
                  <input
                    inputMode="numeric"
                    value={blankPrintForm.startCode}
                    placeholder="Ej: 1273"
                    onChange={(event) =>
                      setBlankPrintForm((previous) => ({
                        ...previous,
                        startCode: event.target.value.replace(/\D/g, ''),
                      }))
                    }
                  />
                </label>
                {blankPrintForm.residences.map((residence, index) => {
                  const range = getBlankResidenceRange(index)
                  return (
                    <div className="row" key={`blank-residence-${index + 1}`}>
                      <div className="row-main">
                        <strong>Residencia {index + 1}</strong>
                        <label className="modal-label">
                          <span>Nombre</span>
                          <input
                            value={residence.residenceName}
                            placeholder="Ej: RESIDENCIA FAMILIAR PEHUENCHE"
                            onChange={(event) =>
                              updateBlankResidence(index, { residenceName: event.target.value })
                            }
                          />
                        </label>
                        <label className="modal-label">
                          <span>Cantidad de etiquetas</span>
                          <input
                            inputMode="numeric"
                            value={residence.quantity}
                            placeholder="Ej: 200"
                            onChange={(event) =>
                              updateBlankResidence(index, {
                                quantity: event.target.value.replace(/\D/g, ''),
                              })
                            }
                          />
                        </label>
                        {range && (
                          <span className="muted">
                            Rango: <strong>{formatMauPreview(range.start)}</strong> hasta{' '}
                            <strong>{formatMauPreview(range.end)}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {hasBlankStartCodeInput && blankTotalQuantity > 0 && (
                  <p className="muted">
                    Total: <strong>{blankTotalQuantity}</strong> etiquetas. Rango general:{' '}
                    <strong>{formatMauPreview(blankFirstCode)}</strong> hasta{' '}
                    <strong>{formatMauPreview(blankLastCode)}</strong>.
                  </p>
                )}
                <div className="modal-actions">
                  <button type="button" onClick={confirmBlankPrint} disabled={!canPrintBlankLabels}>
                    Imprimir etiquetas MAU
                  </button>
                  <button type="button" className="ghost" onClick={() => setBlankPrintOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

function AssetsListView(props) {
  return (
    <>
      <AssetCatalogTable {...props} />
      <AssetRecordsTable {...props} />
    </>
  )
}

export default AssetsListView
