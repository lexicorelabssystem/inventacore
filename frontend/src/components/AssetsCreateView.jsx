import { useMemo } from 'react'
import { UI_TEXT } from '../constants/uiText'

function AssetCreateFormCard(props) {
  const {
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
  } = props

  const depreciationPreview = useMemo(
    () =>
      calculateStraightLineDepreciation({
        acquisitionValue: assetForm.acquisitionValue,
        usefulLifeYears: assetForm.usefulLifeYears,
        residualValue: assetForm.residualValue,
      }),
    [
      calculateStraightLineDepreciation,
      assetForm.acquisitionValue,
      assetForm.usefulLifeYears,
      assetForm.residualValue,
    ]
  )

  return (
    <div className="form-card">
      <h4>Crear activo fijo</h4>
      <div className="select-wrap">
        <label>{UI_TEXT.institution}</label>
        <select
          value={assetInstitutionId}
          onChange={(e) => {
            const value = e.target.value
            setAssetInstitutionId(value)
            setAssetEstablishments([])
            setAssetDependencies([])
            setAssetForm((prev) => ({
              ...prev,
              establishmentId: '',
              dependencyId: '',
            }))
            if (value) loadAssetEstablishments(value)
          }}
        >
          <option value="">{`Selecciona una ${UI_TEXT.institution.toLowerCase()}`}</option>
          {institutionsCatalog.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
            </option>
          ))}
        </select>
        {assetInstitutionId && (
          <p className="muted">{`${UI_TEXT.institution} seleccionada: ${selectedAssetInstitution.name || 'N/D'}`}</p>
        )}
      </div>

      <div className="select-wrap">
        <label>Establecimiento</label>
        <select
          value={assetForm.establishmentId}
          onChange={(e) => {
            const value = e.target.value
            setAssetDependencies([])
            setAssetForm((prev) => ({
              ...prev,
              establishmentId: value,
              dependencyId: '',
            }))
            if (value) loadAssetDependencies(value)
          }}
        >
          <option value="">Selecciona establecimiento</option>
          {assetEstablishments.map((est) => (
            <option key={est.id} value={est.id}>
              {est.name}
            </option>
          ))}
        </select>
        {assetForm.establishmentId && (
          <p className="muted">
            Establecimiento seleccionado: {selectedAssetEstablishment?.name || 'N/D'}
          </p>
        )}
        {assetErrors.establishmentId && <p className="error">{assetErrors.establishmentId}</p>}
      </div>

      <div className="select-wrap">
        <label>Sector</label>
        <select
          value={assetForm.dependencyId}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, dependencyId: e.target.value }))}
          disabled={!assetForm.establishmentId}
        >
          <option value="">Selecciona sector</option>
          {assetDependencies.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
              {selectedAssetEstablishment?.name ? ` - ${selectedAssetEstablishment.name}` : ''}
            </option>
          ))}
        </select>
        {assetErrors.dependencyId && <p className="error">{assetErrors.dependencyId}</p>}
      </div>

      <div className="select-wrap">
        <label>Estado</label>
        <select
          value={assetForm.assetStateId}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, assetStateId: e.target.value }))}
        >
          <option value="">Selecciona estado</option>
          {assetStates.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
        {assetErrors.assetStateId && <p className="error">{assetErrors.assetStateId}</p>}
      </div>

      <div className="select-wrap">
        <label>Tipo de activo fijo</label>
        <select
          value={assetForm.assetTypeId}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, assetTypeId: e.target.value }))}
        >
          <option value="">Selecciona tipo</option>
          {assetTypes.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.name}
            </option>
          ))}
        </select>
        {assetErrors.assetTypeId && <p className="error">{assetErrors.assetTypeId}</p>}
      </div>

      <div className="select-wrap">
        <label>{UI_TEXT.catalog}</label>
        <p className="muted">{`Selecciona desde la lista de ${UI_TEXT.catalog.toLowerCase()} disponible.`}</p>
        <select
          value={assetForm.catalogItemId}
          disabled={assetMultiProductEnabled}
          onChange={(e) => handleSelectCatalogItem(e.target.value)}
        >
          <option value="">{UI_TEXT.catalogManual}</option>
          {assetCatalogItems.map((item) => (
            <option key={item.id} value={item.id}>
              {formatCatalogItemDisplay(item)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Nombre</label>
        <input
          value={assetForm.name}
          disabled={assetMultiProductEnabled}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ej: Mesa redonda reuniones"
        />
        {assetErrors.name && <p className="error">{assetErrors.name}</p>}
      </div>

      <div className="field">
        <label>Marca</label>
        <input
          value={assetForm.brand}
          disabled={assetMultiProductEnabled}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, brand: e.target.value }))}
        />
      </div>

      <div className="field">
        <label>Modelo</label>
        <input
          value={assetForm.modelName}
          disabled={assetMultiProductEnabled}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, modelName: e.target.value }))}
        />
      </div>

      <div className="field">
        <label>Serie</label>
        <input
          value={assetForm.serialNumber}
          disabled={assetMultiProductEnabled || Number(assetForm.quantity) > 1}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, serialNumber: e.target.value }))}
        />
        {(assetMultiProductEnabled || Number(assetForm.quantity) > 1) && (
          <p className="muted">
            {'Para creaci\u00f3n en lote la serie debe quedar vac\u00eda (se crean activos individuales).'}
          </p>
        )}
      </div>

      <div className="field">
        <label>Cantidad</label>
        <input
          type="number"
          min="1"
          step="1"
          value={assetForm.quantity}
          disabled={assetMultiProductEnabled}
          onChange={(e) => {
            const nextQuantity = e.target.value
            setAssetForm((prev) => ({
              ...prev,
              quantity: nextQuantity,
              serialNumber: Number(nextQuantity) > 1 ? '' : prev.serialNumber,
            }))
          }}
        />
        {assetErrors.quantity && <p className="error">{assetErrors.quantity}</p>}
      </div>

      <label className="inline-check">
        <input
          type="checkbox"
          checked={assetMultiProductEnabled}
          onChange={(e) => {
            const enabled = e.target.checked
            setAssetMultiProductEnabled(enabled)
            if (enabled) {
              resizeMultiProducts(assetMultiProductCount || '2')
              setSelectedCatalogItem(null)
              setAssetForm((prev) => ({ ...prev, serialNumber: '' }))
            }
          }}
        />
        Crear varios productos distintos (lote)
      </label>

      {assetMultiProductEnabled && (
        <div className="field">
          <label>{'\u00bfCu\u00e1ntos productos distintos deseas agregar?'}</label>
          <input
            type="number"
            min="1"
            max="20"
            value={assetMultiProductCount}
            onChange={(e) => resizeMultiProducts(e.target.value)}
          />
          <p className="muted">{`Define cada producto con su ${UI_TEXT.catalog.toLowerCase()}, cantidad y precio propio.`}</p>
          {assetMultiProducts.map((row, index) => (
            <div
              key={`multi-row-${index}`}
              style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 8 }}
            >
              <label>{`Producto ${index + 1} - ${UI_TEXT.catalog}`}</label>
              <select
                value={row.catalogItemId}
                onChange={(e) => updateMultiProductRow(index, { catalogItemId: e.target.value })}
              >
                <option value="">{`Selecciona un ${UI_TEXT.itemSingular} de ${UI_TEXT.catalog.toLowerCase()}`}</option>
                {assetCatalogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatCatalogItemDisplay(item)}
                  </option>
                ))}
              </select>
              <label>Cantidad producto {index + 1}</label>
              <input
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) => updateMultiProductRow(index, { quantity: e.target.value })}
              />
              <label>Precio producto {index + 1}</label>
              <input
                type="number"
                min="1"
                step="1"
                value={row.acquisitionValue}
                onChange={(e) => updateMultiProductRow(index, { acquisitionValue: e.target.value })}
              />
            </div>
          ))}
          <p className="muted">Total de bienes a crear: {multiProductsTotalQuantity}</p>
          {assetErrors.multiProducts && <p className="error">{assetErrors.multiProducts}</p>}
        </div>
      )}

      <div className="field">
        <label>Cuenta contable</label>
        <input
          value={assetForm.accountingAccount}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, accountingAccount: e.target.value }))}
        />
        {assetErrors.accountingAccount && <p className="error">{assetErrors.accountingAccount}</p>}
      </div>

      <div className="field">
        <label>{'C\u00f3digo anal\u00edtico'}</label>
        <input
          value={assetForm.analyticCode || 'Se genera autom\u00e1ticamente al crear'}
          readOnly
          disabled
        />
        <p className="muted">{`${UI_TEXT.code} generado por el sistema.`}</p>
      </div>

      <label className="inline-check">
        <input
          type="checkbox"
          checked={!assetHasResponsible}
          onChange={(e) => {
            const withoutResponsible = e.target.checked
            setAssetHasResponsible(!withoutResponsible)
            if (withoutResponsible) {
              setAssetForm((prev) => ({
                ...prev,
                responsibleName: '',
                responsibleRut: '',
                responsibleRole: '',
                costCenter: '',
              }))
            }
          }}
        />
        Sin responsable asignado
      </label>

      {assetHasResponsible ? (
        <>
          <div className="field">
            <label>Responsable (nombre)</label>
            <input
              value={assetForm.responsibleName}
              onChange={(e) => setAssetForm((prev) => ({ ...prev, responsibleName: e.target.value }))}
              placeholder="Nombre completo"
            />
          </div>

          <div className="field">
            <label>RUT responsable</label>
            <input
              value={assetForm.responsibleRut}
              onChange={(e) => setAssetForm((prev) => ({ ...prev, responsibleRut: e.target.value }))}
              onBlur={(e) =>
                setAssetForm((prev) => ({
                  ...prev,
                  responsibleRut: normalizeRutValue(e.target.value),
                }))
              }
              placeholder="12.345.678-9"
            />
            {assetErrors.responsibleRut && <p className="error">{assetErrors.responsibleRut}</p>}
          </div>

          <div className="field">
            <label>Cargo responsable</label>
            <input
              value={assetForm.responsibleRole}
              onChange={(e) => setAssetForm((prev) => ({ ...prev, responsibleRole: e.target.value }))}
              placeholder="Ej: Encargado de bodega"
            />
          </div>

          <div className="field">
            <label>Centro de costo</label>
            <input
              value={assetForm.costCenter}
              onChange={(e) => setAssetForm((prev) => ({ ...prev, costCenter: e.target.value }))}
              onBlur={(e) =>
                setAssetForm((prev) => ({
                  ...prev,
                  costCenter: normalizeCostCenterValue(e.target.value),
                }))
              }
              placeholder="Ej: CC-ADM-01"
            />
          </div>
        </>
      ) : (
        <p className="muted">{'Se crear\u00e1 el activo fijo sin responsable asignado.'}</p>
      )}

      <div className="field">
        <label>{'Valor de adquisici\u00f3n'}</label>
        <input
          type="number"
          value={assetForm.acquisitionValue}
          disabled={assetMultiProductEnabled}
          onChange={(e) => setAssetForm((prev) => ({ ...prev, acquisitionValue: e.target.value }))}
        />
        {assetMultiProductEnabled && (
          <p className="muted">En modo lote, el precio se define por producto.</p>
        )}
        {assetErrors.acquisitionValue && <p className="error">{assetErrors.acquisitionValue}</p>}
      </div>

      <div className="field">
        <label>{'Fecha de adquisici\u00f3n'}</label>
        <input
          type="date"
          value={assetForm.acquisitionDate}
          onChange={(e) =>
            setAssetForm((prev) => ({
              ...prev,
              acquisitionDate: e.target.value,
              depreciationStartDate: prev.depreciationStartDate || e.target.value,
            }))
          }
        />
        {assetErrors.acquisitionDate && <p className="error">{assetErrors.acquisitionDate}</p>}
      </div>

      <div className="field">
        <label>Depreciacion contable</label>
        <div className="field">
          <label>Metodo</label>
          <input value={assetForm.depreciationMethod || 'LINEAL'} readOnly disabled />
          <p className="muted">LINEAL: se reparte la depreciación en cuotas iguales por año.</p>
        </div>
        <div className="field">
          <label>Vida util (años)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={assetForm.usefulLifeYears}
            onChange={(e) => setAssetForm((prev) => ({ ...prev, usefulLifeYears: e.target.value }))}
            placeholder="Ej: 4"
          />
          {assetErrors.usefulLifeYears && <p className="error">{assetErrors.usefulLifeYears}</p>}
        </div>
        <div className="field">
          <label>Valor residual (%)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={assetForm.residualValue}
            onChange={(e) => setAssetForm((prev) => ({ ...prev, residualValue: e.target.value }))}
            placeholder="Ej: 1"
          />
          <p className="muted">
            Se calcula automatico como monto: valor de adquisicion x porcentaje / 100.
          </p>
          {assetErrors.residualValue && <p className="error">{assetErrors.residualValue}</p>}
        </div>
        <div className="field">
          <label>Fecha inicio depreciacion</label>
          <input
            type="date"
            value={assetForm.depreciationStartDate}
            onChange={(e) =>
              setAssetForm((prev) => ({ ...prev, depreciationStartDate: e.target.value }))
            }
          />
          <p className="muted">Si no se informa, se considera la fecha de adquisicion.</p>
          {assetErrors.depreciationStartDate && (
            <p className="error">{assetErrors.depreciationStartDate}</p>
          )}
        </div>
        {!assetMultiProductEnabled && depreciationPreview && (
          <div className="muted">
            <p>Preview de calculo</p>
            <p>{`Valor residual (%): ${depreciationPreview.residualRate.toFixed(4)}`}</p>
            <p>{`Valor residual (CLP): ${depreciationPreview.residualAmount.toFixed(2)}`}</p>
            <p>{`Base depreciable: ${depreciationPreview.depreciableBase.toFixed(2)}`}</p>
            <p>{`Depreciacion anual: ${depreciationPreview.annual.toFixed(2)}`}</p>
            <p>{`Depreciacion mensual: ${depreciationPreview.monthly.toFixed(2)}`}</p>
            <p>{`Tasa depreciacion anual (%): ${depreciationPreview.rate.toFixed(4)}`}</p>
          </div>
        )}
        {assetMultiProductEnabled && (
          <p className="muted">
            En modo lote, el calculo se aplica automaticamente por cada producto segun su precio.
          </p>
        )}
        {assetErrors.depreciationConfig && <p className="error">{assetErrors.depreciationConfig}</p>}
      </div>

      <div className="actions">
        <button className="primary" onClick={handleCreateAsset} disabled={assetCreating}>
          {assetCreating
            ? 'Creando...'
            : assetMultiProductEnabled
              ? 'Crear activos fijos (lote)'
              : 'Crear activo fijo'}
        </button>
        <button
          className="ghost"
          onClick={() =>
            (() => {
              setAssetForm({
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
              setAssetHasResponsible(true)
              setCreatedAsset(null)
              setCreatedAssetBatch([])
              setAssetMultiProductEnabled(false)
              setAssetMultiProductCount('2')
              setAssetMultiProducts([
                { catalogItemId: '', quantity: '1', acquisitionValue: '' },
                { catalogItemId: '', quantity: '1', acquisitionValue: '' },
              ])
              setQrCodeUrl('')
            })()
          }
        >
          {UI_TEXT.clear}
        </button>
      </div>
    </div>
  )
}

function AssetLabelCard(props) {
  const {
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
    setCreatedAsset,
    setCreatedAssetBatch,
    setSelectedCatalogItem,
    openPrintLabel,
    createdAssetBatch,
    openPrintBatchLabels,
    qrCodeUrl,
  } = props

  return (
    <div className="form-card">
      <h4>Etiqueta</h4>
      <div className="field">
        <label>{`Escanear o pegar ${UI_TEXT.code.toLowerCase()} QR`}</label>
        <div className="actions">
          <input
            placeholder="Ej: INV-123 o 123"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                resolveScannedAsset()
              }
            }}
          />
          <button className="ghost" onClick={resolveScannedAsset}>
            {UI_TEXT.searchAction}
          </button>
          <button
            className="ghost"
            onClick={() => {
              setScanInput('')
              setScanResult(null)
            }}
          >
            {UI_TEXT.clear}
          </button>
        </div>
        {scanResult && (
          <p
            className={
              scanResult.status === 'ok' ? 'status ok inline-status' : 'status error inline-status'
            }
          >
            {scanResult.message}
          </p>
        )}
      </div>

      {!createdAsset && (
        <>
          <p className="muted">Crea un activo fijo o selecciona uno de la lista.</p>
          <div className="field">
            <label>Seleccionar activo fijo</label>
            <select
              value={labelAssetId}
              onChange={(e) => {
                const value = e.target.value
                setLabelAssetId(value)
                const asset = assetsList.find((a) => String(a.id) === String(value))
                if (asset) {
                  const selectedId = toPositiveIntOrNull(asset.id)
                  setCreatedAsset(asset)
                  setCreatedAssetBatch([])
                  setSelectedCatalogItem(asset.catalogItem || null)
                  if (selectedId) {
                    localStorage.setItem('last_asset_id', String(selectedId))
                  }
                }
              }}
            >
              <option value="">Selecciona activo fijo</option>
              {assetsList.map((a) => (
                <option key={a.id} value={a.id}>
                  INV-{a.internalCode} - {a.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {createdAsset && labelData && (
        <div className="label-preview">
          <div className="label-code">
            {UI_TEXT.code}: <strong>{labelData.code}</strong>
          </div>
          <div className="label-scan-info">
            <span>ID: #{createdAsset.id}</span>
            <span>Cantidad: {createdAsset.quantity  -  1}</span>
            {createdAsset.serialNumber && <span>Serie: {createdAsset.serialNumber}</span>}
            {createdAsset.brand && <span>Marca: {createdAsset.brand}</span>}
            {createdAsset.modelName && <span>Modelo: {createdAsset.modelName}</span>}
            {createdAsset.responsibleName && <span>Responsable: {createdAsset.responsibleName}</span>}
            {createdAsset.costCenter && <span>CC: {createdAsset.costCenter}</span>}
          </div>
          <div className="label-meta">
            <span>Nombre: {labelData.name}</span>
            {labelData.establishment && <span>Est: {labelData.establishment}</span>}
            {labelData.dependency && <span>Dep: {labelData.dependency}</span>}
            {labelData.assetState && <span>Estado: {labelData.assetState}</span>}
          </div>
          {qrCodeUrl && <img className="qr" src={qrCodeUrl} alt="QR" />}
          <svg id="barcode-preview" className="barcode" />
          <div className="actions">
            <button className="ghost" onClick={openPrintLabel}>
              Imprimir / Exportar PDF
            </button>
            {createdAssetBatch.length > 1 &&
              createdAssetBatch.some(
                (item) => String(item?.id || '') === String(createdAsset?.id || '')
              ) && (
                <>
                  <button className="ghost" onClick={openPrintBatchLabels}>
                    Imprimir todas / Exportar PDF
                  </button>
                </>
              )}
            <button
              className="ghost"
              onClick={() => {
                const value = labelData.code
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(value)
                }
              }}
            >
              {UI_TEXT.copyCode}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AssetsCreateView(props) {
  return (
    <>
      <AssetCreateFormCard {...props} />
      <AssetLabelCard {...props} />
    </>
  )
}

export default AssetsCreateView

