import { useState } from 'react'

const PLANCHETA_QR_LOGO_OPTIONS = [
  { value: 'gob', label: 'Logo Servicio Ninez' },
  { value: 'inventacore', label: 'Logo Inventacore' },
  { value: 'none', label: 'Sin logo' },
]

function formatPlanchetaDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatPlanchetaDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPlanchetaCode(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric <= 0) return 'MAU0000000'
  return `MAU${String(numeric).padStart(7, '0')}`
}

function resolvePlanchetaDisplayCode(assetLike) {
  if (!assetLike || typeof assetLike !== 'object') return null
  return assetLike.visibleCode || assetLike.internalCode || null
}

function formatPlanchetaMovementDetail(movement, formatPlanchetaMovement) {
  const parts = []
  const dateText = formatPlanchetaDateTime(movement?.createdAt)
  if (dateText !== '-') {
    parts.push(dateText)
  }
  const movementText = formatPlanchetaMovement(movement)
  if (movementText) {
    parts.push(movementText)
  }
  if (movement?.user?.name) {
    parts.push(`Usuario: ${movement.user.name}`)
  }
  if (movement?.fromDependency?.name || movement?.toDependency?.name) {
    parts.push(
      `Ruta: ${movement?.fromDependency?.name || 'Origen'} -> ${
        movement?.toDependency?.name || 'Destino'
      }`
    )
  }
  return parts.join(' | ') || 'Movimiento'
}

function PlanchetasSection(props) {
  const {
    canPreviewPlancheta,
    canExportPlancheta,
    loadPlanchetaPreview,
    downloadPlancheta,
    planchetaPreviewLoading,
    planchetaQuery,
    planchetaPreview,
    planchetaDirectory = [],
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
  } = props
  const [planchetaLabelLogo, setPlanchetaLabelLogo] = useState('gob')

  return (
    <div className="section module-section module-section-planchetas">
      <div className="section-head">
        <h3>Planchetas</h3>
        <div className="plancheta-actions-block">
          <div className="actions plancheta-actions-top">
            <button className="ghost" disabled={!canPreviewPlancheta} onClick={loadPlanchetaPreview}>
              Previsualizar
            </button>
          </div>
          <div className="plancheta-actions-grid">
            <button
              className="ghost"
              disabled={!canExportPlancheta}
              title={!canExportPlancheta ? 'Previsualiza con datos antes de descargar archivo.' : ''}
              onClick={() => downloadPlancheta('excel', 'formal')}
            >
              Excel Formal
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta}
              title={!canExportPlancheta ? 'Previsualiza con datos antes de descargar archivo.' : ''}
              onClick={() => downloadPlancheta('pdf', 'formal')}
            >
              PDF Formal
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta}
              title={!canExportPlancheta ? 'Previsualiza con datos antes de descargar archivo.' : ''}
              onClick={() => downloadPlancheta('excel', 'compacta')}
            >
              Excel Servicio Ninez
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta}
              title={!canExportPlancheta ? 'Previsualiza con datos antes de descargar archivo.' : ''}
              onClick={() => downloadPlancheta('pdf', 'compacta')}
            >
              PDF Servicio Ninez
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta || !planchetaDirectory.length}
              title={
                !canExportPlancheta
                  ? 'Previsualiza con datos antes de descargar archivo.'
                  : !planchetaDirectory.length
                    ? 'El directorio necesita resultados visibles para previsualizacion.'
                    : ''
              }
              onClick={() => downloadPlancheta('excel', 'directorio')}
            >
              Excel Directorio
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta || !planchetaDirectory.length}
              title={
                !canExportPlancheta
                  ? 'Previsualiza con datos antes de descargar archivo.'
                  : !planchetaDirectory.length
                    ? 'El directorio necesita resultados visibles para previsualizacion.'
                    : ''
              }
              onClick={() => downloadPlancheta('pdf', 'directorio')}
            >
              PDF Directorio
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta}
              title={!canExportPlancheta ? 'Previsualiza con datos antes de descargar archivo.' : ''}
              onClick={() => downloadPlancheta('excel', 'gerencial')}
            >
              Excel Gerencial
            </button>
            <button
              className="ghost"
              disabled={!canExportPlancheta}
              title={!canExportPlancheta ? 'Previsualiza con datos antes de descargar archivo.' : ''}
              onClick={() => downloadPlancheta('pdf', 'gerencial')}
            >
              PDF Gerencial
            </button>
          </div>
          <div className="plancheta-qr-tools">
            <div className="label-print-card">
              <strong className="label-print-title">Etiquetas QR</strong>
              <div className="select-wrap">
                <label>Logo etiquetas</label>
                <select
                  value={planchetaLabelLogo}
                  onChange={(e) => setPlanchetaLabelLogo(e.target.value)}
                  disabled={!canExportPlancheta}
                >
                  {PLANCHETA_QR_LOGO_OPTIONS.map((logoOption) => (
                    <option key={logoOption.value} value={logoOption.value}>
                      {logoOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="ghost"
                disabled={!canExportPlancheta}
                title={!canExportPlancheta ? 'Previsualiza con datos antes de imprimir.' : ''}
                onClick={() => openPrintPlanchetaQrLabels({ brandKey: planchetaLabelLogo })}
              >
                Imprimir etiquetas QR
              </button>
            </div>
            <div className="label-print-card">
              <strong className="label-print-title">Etiquetas Barra</strong>
              <button
                className="ghost"
                disabled={!canExportPlancheta}
                title={!canExportPlancheta ? 'Previsualiza con datos antes de imprimir.' : ''}
                onClick={() => openPrintPlanchetaBarcodeLabels({ brandKey: planchetaLabelLogo })}
              >
                Imprimir etiquetas barra
              </button>
            </div>
          </div>
        </div>
      </div>
      {!planchetaPreviewLoading && planchetaQuery && !planchetaPreview.length && (
        <p className="muted">Previsualiza primero. Si no hay filas, la exportación queda bloqueada.</p>
      )}
      <div className="split">
        <div className="form-card">
          <h4>Filtros</h4>
          <div className="select-wrap">
            <label>Institución</label>
            <select
              value={planchetaFilters.institutionId}
              onChange={(e) => {
                const value = e.target.value
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  institutionId: value,
                  establishmentId: '',
                  dependencyId: '',
                }))
                if (value) loadPlanchetaEstablishments(value)
                else setPlanchetaEstablishments([])
                setPlanchetaDependencies([])
              }}
              disabled={loadingPlancheta}
            >
              <option value="">Selecciona institución</option>
              {planchetaInstitutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div className="select-wrap">
            <label>Establecimiento</label>
            <select
              value={planchetaFilters.establishmentId}
              onChange={(e) => {
                const value = e.target.value
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  establishmentId: value,
                  dependencyId: '',
                }))
                if (value) loadPlanchetaDependencies(value)
                else setPlanchetaDependencies([])
              }}
              disabled={loadingPlancheta || !planchetaFilters.institutionId}
            >
              <option value="">Selecciona establecimiento</option>
              {planchetaEstablishments.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.name}
                </option>
              ))}
            </select>
          </div>
          <div className="select-wrap">
            <label>Sector (opcional)</label>
            <select
              value={planchetaFilters.dependencyId}
              onChange={(e) =>
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  dependencyId: e.target.value,
                }))
              }
              disabled={loadingPlancheta || !planchetaFilters.establishmentId}
            >
              <option value="">Todos</option>
              {planchetaDependencies.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>
          <div className="select-wrap">
            <label>Responsable (filtro)</label>
            <input
              value={planchetaFilters.responsibleFilterName || ''}
              onChange={(e) =>
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  responsibleFilterName: e.target.value,
                }))
              }
              placeholder="Ej: CECILIA GAJARDO ORELLANA"
            />
          </div>
          <p className="muted">Si no eliges sector, la plancheta se genera por establecimiento.</p>
          <div className="split">
            <div className="select-wrap">
              <label>Fecha de adquisición desde (opcional)</label>
              <input
                type="date"
                value={planchetaFilters.fromDate}
                onChange={(e) =>
                  setPlanchetaFilters((prev) => ({
                    ...prev,
                    fromDate: e.target.value,
                  }))
                }
              />
            </div>
            <div className="select-wrap">
              <label>Fecha de adquisición hasta (opcional)</label>
              <input
                type="date"
                value={planchetaFilters.toDate}
                onChange={(e) =>
                  setPlanchetaFilters((prev) => ({
                    ...prev,
                    toDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="select-wrap">
            <label>Encargado de sector (firma)</label>
            <input
              value={planchetaFilters.responsibleName}
              onChange={(e) =>
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  responsibleName: e.target.value,
                }))
              }
              placeholder="Nombre encargado"
            />
          </div>
          <div className="select-wrap">
            <label>Jefe de sector (firma)</label>
            <input
              value={planchetaFilters.chiefName}
              onChange={(e) =>
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  chiefName: e.target.value,
                }))
              }
              placeholder="Nombre jefe"
            />
          </div>
          <div className="select-wrap">
            <label>Texto ministerial</label>
            <textarea
              rows={4}
              value={planchetaFilters.ministryText}
              onChange={(e) =>
                setPlanchetaFilters((prev) => ({
                  ...prev,
                  ministryText: e.target.value,
                }))
              }
            />
          </div>
          <p className="muted">Historial de bajas desactivado para esta plancheta.</p>
        </div>
      </div>
      {planchetaPreviewLoading && <p className="muted">Cargando plancheta...</p>}
      {!planchetaPreviewLoading && planchetaMessage && <p className="muted">{planchetaMessage}</p>}
      {!planchetaPreviewLoading && planchetaInsights && (
        <div className="table">
          <div className="table-head">
            <h4>Resumen operativo</h4>
            <span className="muted">Se usa el mismo alcance de la plancheta</span>
          </div>
          {planchetaFilters.includeHistory && (
            <div className="row">
              <div>
                <strong>{`Ultimos 7 dias: ${planchetaInsights.weekly?.count || 0} registros / ${
                  planchetaInsights.weekly?.units || 0
                } bienes`}</strong>
                <div className="muted">{`Ultimos 30 dias: ${planchetaInsights.monthly?.count || 0} registros / ${
                  planchetaInsights.monthly?.units || 0
                } bienes`}</div>
              </div>
            </div>
          )}
          {!!planchetaInsights.stateOverview?.length && (
            <div className="row">
              <div>
                <strong>Estados actuales (solo activos vigentes)</strong>
                <div className="muted">
                  {planchetaInsights.stateOverview
                    .slice(0, 5)
                    .map((row) => `${row.label}: ${row.count}`)
                    .join(' | ')}
                </div>
              </div>
            </div>
          )}
          {!!planchetaInsights.monthly?.items?.length && (
            <div className="row">
              <div>
                <strong>Bajas recientes</strong>
                <div className="muted">
                  {planchetaInsights.monthly.items
                    .slice(0, 4)
                    .map(
                      (item) =>
                        `${formatPlanchetaCode(resolvePlanchetaDisplayCode(item))} ${item.name} (${item.dependencyName || 'Sin sector'})`
                    )
                    .join(' | ')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {!planchetaPreviewLoading && planchetaDirectory.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Historial por funcionario y asignaciones</h4>
            <span className="muted">Agrupado por responsable del activo</span>
          </div>
          {planchetaDirectory.map((group) => (
            <div key={group.key} className="table">
              <div className="row">
                <div>
                  <strong>{group.responsibleName || 'Sin asignar'}</strong>
                  <div className="muted">
                    RUT: {group.responsibleRut || '-'} | Cargo:{' '}
                    {group.responsibleRoles?.join(' / ') || '-'} | CC:{' '}
                    {group.costCenters?.join(' / ') || '-'}
                  </div>
                  <div className="muted">
                    Sectores: {group.dependencies?.join(' | ') || 'Sin sector'}
                  </div>
                </div>
                <div className="muted">
                  Activos: {group.assetCount || 0} | Unidades: {group.unitCount || 0}
                  {' | '}Movimientos: {group.movementCount || 0}
                </div>
              </div>
              <div className="row">
                <div>
                  <strong>Ultimo movimiento</strong>
                  <div className="muted">
                    {formatPlanchetaDateTime(group.latestMovementAt)}
                  </div>
                </div>
                <div className="muted">
                  Vista formal de custodia y reasignaciones
                </div>
              </div>
              {group.assets.map((asset) => (
                <div key={asset.id} className="row">
                  <div>
                    <strong>{formatPlanchetaCode(resolvePlanchetaDisplayCode(asset))}</strong> | {asset.name}
                    <div className="muted">
                      Marca: {asset.brand || '-'} | Modelo: {asset.modelName || '-'}
                    </div>
                    <div className="muted">
                      Sector: {asset.dependencyName || '-'}
                    </div>
                    <div className="muted">
                      Cantidad: {asset.quantity ?? 1} | Adquisicion:{' '}
                      {formatPlanchetaDate(asset.acquisitionDate)} | Vida util:{' '}
                      {asset.usefulLifeYears || '-'} anos
                    </div>
                  </div>
                  <div className="muted">
                    <div>
                      <strong>Historial reciente</strong>
                    </div>
                    {planchetaFilters.includeHistory ? (
                      asset.movements?.length ? (
                        asset.movements.slice(0, 3).map((movement) => (
                          <div key={movement.id}>
                            {formatPlanchetaMovementDetail(movement, formatPlanchetaMovement)}
                          </div>
                        ))
                      ) : (
                        <div>Sin movimientos recientes</div>
                      )
                    ) : (
                      <div>Historial desactivado en esta vista</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {!planchetaPreviewLoading && planchetaSummary.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Resumen por sector y producto</h4>
            <span className="muted">Vista resumida (hasta 100 filas)</span>
          </div>
          {planchetaSummary.slice(0, 100).map((row, idx) => (
            <div
              key={`plancheta-summary-${row.dependencyId}-${row.productName}-${idx}`}
              className="row"
            >
              <div>
                <strong>{row.dependencyName || 'Sin sector'}</strong>
                <div className="muted">Producto: {row.productName || 'Sin nombre'}</div>
                <div className="muted">Categoría: {row.category || 'Sin categoría'}</div>
              </div>
              <div className="muted">
                Marca: {row.brand || '-'} | Modelo: {row.modelName || '-'} | Cantidad total:{' '}
                {row.quantity}
              </div>
            </div>
          ))}
        </div>
      )}
      {!planchetaPreviewLoading && planchetaPreview.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Detalle de activos (muestra)</h4>
            <span className="muted">Vista de control (hasta 20 filas)</span>
          </div>
          {planchetaPreview.slice(0, 20).map((item) => (
            <div key={item.id} className="row">
              <div>
                <strong>{formatPlanchetaCode(resolvePlanchetaDisplayCode(item))}</strong> | {item.name}
                <div className="muted">
                  Marca: {item.brand || '-'} | Modelo: {item.modelName || '-'}
                </div>
              </div>
              <div className="muted">
                Sector: {item.dependency?.name || '-'}
              </div>
              <div className="muted">
                Cantidad: {item.quantity ?? 1} | RUT: {item.responsibleRut || '-'}
                {' | '}Cargo: {item.responsibleRole || '-'} | CC: {item.costCenter || '-'}
              </div>
              <div className="muted">
                Valor adq: $
                {Number(item.acquisitionValue || 0).toLocaleString('es-CL', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
                {' | '}Deprec. anual: $
                {Number(item.depreciationAnnualValue || 0).toLocaleString('es-CL', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
                {' | '}Vida útil: {item.usefulLifeYears || '-'} años
              </div>
              {planchetaFilters.includeHistory && (
                <div className="muted">
                  Historial reciente:{' '}
                  {(item.movements || []).map(formatPlanchetaMovement).join(' | ') ||
                    'Sin movimientos'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PlanchetasSection
