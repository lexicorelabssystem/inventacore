import { UI_TEXT } from '../constants/uiText'

function ImportsCatalogView(props) {
  const {
    downloadFile,
    purgeCatalogAllWithReset,
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
  } = props

  return (
    <div className="section">
      <div className="section-head">
        <h3>{`Importar ${UI_TEXT.catalog.toLowerCase()}`}</h3>
        <div className="actions">
          <button
            className="ghost"
            onClick={() =>
              downloadFile('/admin/catalog-items/import/template/excel', 'catalog_items_template.xlsx')
            }
          >
            Descargar plantilla Activo fijo
          </button>
          <button
            className={dangerZoneUnlocked ? 'ghost' : 'primary'}
            onClick={dangerZoneUnlocked ? lockDangerZoneButtons : unlockDangerZoneButtons}
            disabled={dangerZoneUnlocking}
          >
            {dangerZoneUnlocking
              ? 'Verificando...'
              : dangerZoneUnlocked
              ? 'Bloquear botones'
              : 'Desbloquear botones'}
          </button>
          <button
            className="danger danger-outline"
            onClick={purgeCatalogAllWithReset}
            disabled={!dangerZoneUnlocked}
            title={!dangerZoneUnlocked ? 'Primero habilita las acciones críticas.' : ''}
          >
            {`Vaciar ${UI_TEXT.catalog.toLowerCase()} (ID=1)`}
          </button>
        </div>
      </div>

      <div className="split">
        <div className="form-card upload-card">
          <h4>Carga masiva desde Excel</h4>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setCatalogImportFile(e.target.files?.[0] || null)}
          />
          <p className="muted">
            {`Soporta plantilla est\u00e1ndar de ${UI_TEXT.catalog.toLowerCase()} y tambi\u00e9n tu formato inventario avanzado (CODIGO_ACTIVO, CARACTERISTICAS, ...).`}
          </p>
          <button className="primary" onClick={handleCatalogImportUpload} disabled={catalogImportLoading}>
            {catalogImportLoading ? 'Importando...' : `Importar ${UI_TEXT.catalog.toLowerCase()}`}
          </button>
        </div>

        <div className="form-card">
          <h4>{'Resultado de la importaci\u00f3n'}</h4>
          {catalogImportResult ? (
            <div className="import-summary">
              <p>{'Filas le\u00eddas: '}<strong>{catalogImportResult.totalRows || 0}</strong></p>
              <p>Parseadas: <strong>{catalogImportResult.parsedCount || 0}</strong></p>
              <p>Creadas: <strong>{catalogImportResult.createdCount || 0}</strong></p>
              <p>Omitidas: <strong>{catalogImportResult.skippedCount || 0}</strong></p>
              <p>{UI_TEXT.errors}: <strong>{catalogImportResult.errorCount || 0}</strong></p>
              <p className="muted">
                Dedupe: {catalogImportResult.dedupePolicy.primary || 'N/D'} | fallback:{' '}
                {catalogImportResult.dedupePolicy.fallback || 'N/D'}
              </p>
              <div className="actions">
                <button
                  className="ghost"
                  onClick={() => downloadCatalogImportReport('created')}
                  disabled={!catalogImportResult.items.length}
                >
                  Descargar creados CSV
                </button>
                <button
                  className="ghost"
                  onClick={() => downloadCatalogImportReport('skipped')}
                  disabled={!catalogImportResult.skipped.length}
                >
                  Descargar omitidos CSV
                </button>
                <button
                  className="ghost"
                  onClick={() => downloadCatalogImportReport('errors')}
                  disabled={!catalogImportResult.errors.length}
                >
                  Descargar errores CSV
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">{`A\u00fan no hay importaci\u00f3n de ${UI_TEXT.catalog.toLowerCase()}.`}</p>
          )}
        </div>
      </div>

      {catalogImportResult?.items?.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Registros creados</h4>
            <span className="muted">Mostrando hasta 20</span>
          </div>
          {catalogImportResult.items.slice(0, 20).map((item, idx) => (
            <div key={`cat-created-${item.id || idx}`} className="row">
              <div>
                <strong>{item.name || 'Sin nombre'}</strong>
                <span className="muted">{' - '}{item.category || 'Sin categor\u00eda'}</span>
              </div>
              <div className="muted">{(item.brand || '-') + ' / ' + (item.modelName || '-')}</div>
            </div>
          ))}
        </div>
      )}

      {catalogImportErrors.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>{`Errores de ${UI_TEXT.catalog.toLowerCase()}`}</h4>
            <span className="muted">Corrige y vuelve a importar</span>
          </div>
          {catalogImportErrors.map((err, idx) => (
            <div key={`cat-err-${idx}`} className="row">
              <div>
                <strong>Fila {err.row}</strong>
              </div>
              <div className="muted">{err.error}</div>
            </div>
          ))}
        </div>
      )}

      {catalogImportResult?.skipped?.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Registros omitidos</h4>
            <span className="muted">Mostrando hasta 20</span>
          </div>
          {catalogImportResult.skipped.slice(0, 20).map((item, idx) => (
            <div key={`cat-skip-${idx}`} className="row">
              <div>
                <strong>{item.name || 'Sin nombre'}</strong>
                <span className="muted">{' - '}{item.category || 'Sin categor\u00eda'}</span>
              </div>
              <div className="muted">{item.reason || 'OMITIDO'}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section-head" style={{ marginTop: '16px' }}>
        <h4>{'Alta manual (casos espec\u00edficos)'}</h4>
      </div>
      <div className="form-card">
        <div className="grid-form">
          <input
            placeholder="Official Key (opcional)"
            value={catalogManualForm.officialKey}
            onChange={(e) => {
              setCatalogManualForm({ ...catalogManualForm, officialKey: e.target.value })
              setManualOfficialKeyCheck(null)
            }}
          />
          <input
            placeholder="Nombre *"
            value={catalogManualForm.name}
            onChange={(e) => setCatalogManualForm({ ...catalogManualForm, name: e.target.value })}
          />
          <input
            placeholder={'Categor\u00eda *'}
            value={catalogManualForm.category}
            onChange={(e) => setCatalogManualForm({ ...catalogManualForm, category: e.target.value })}
          />
          <input
            placeholder={'Subcategor\u00eda'}
            value={catalogManualForm.subcategory}
            onChange={(e) =>
              setCatalogManualForm({
                ...catalogManualForm,
                subcategory: e.target.value,
              })
            }
          />
          <input
            placeholder="Marca"
            value={catalogManualForm.brand}
            onChange={(e) => setCatalogManualForm({ ...catalogManualForm, brand: e.target.value })}
          />
          <input
            placeholder="Modelo"
            value={catalogManualForm.modelName}
            onChange={(e) =>
              setCatalogManualForm({
                ...catalogManualForm,
                modelName: e.target.value,
              })
            }
          />
          <input
            placeholder="Unidad"
            value={catalogManualForm.unit}
            onChange={(e) => setCatalogManualForm({ ...catalogManualForm, unit: e.target.value })}
          />
          <textarea
            placeholder={'Descripci\u00f3n'}
            value={catalogManualForm.description}
            onChange={(e) =>
              setCatalogManualForm({
                ...catalogManualForm,
                description: e.target.value,
              })
            }
            rows={3}
          />
        </div>
        <div className="actions" style={{ marginTop: '12px' }}>
          <button
            className="ghost"
            onClick={checkManualOfficialKeyAvailability}
            disabled={!catalogManualForm.officialKey.trim()}
          >
            Validar officialKey
          </button>
          <button
            className="primary"
            onClick={handleCatalogManualCreate}
            disabled={!catalogManualForm.name.trim() || !catalogManualForm.category.trim()}
          >
            Agregar manualmente
          </button>
        </div>
        {manualOfficialKeyCheck?.message && (
          <p className={manualOfficialKeyCheck.type === 'error' ? 'error' : 'muted'}>
            {manualOfficialKeyCheck.message}
          </p>
        )}
      </div>

      <div className="section-head" style={{ marginTop: '16px' }}>
        <h4>{`Editar ${UI_TEXT.itemPlural} de ${UI_TEXT.catalog.toLowerCase()}`}</h4>
        <div className="actions">
          <input
            placeholder={'Buscar por nombre, categor\u00eda u officialKey...'}
            value={catalogAdminQuery}
            onChange={(e) => setCatalogAdminQuery(e.target.value)}
          />
          <button className="ghost" onClick={() => loadCatalogAdminItems(1)}>
            {UI_TEXT.searchAction}
          </button>
        </div>
      </div>
      <div className="table">
        {catalogAdminLoading ? (
          <p className="muted">{`${UI_TEXT.loading.slice(0, -3)} ${UI_TEXT.catalog.toLowerCase()}...`}</p>
        ) : catalogAdminItems.length ? (
          catalogAdminItems.map((item, idx) => {
            const original = catalogAdminOriginal[item.id]
            const rowStatus = catalogAdminRowStatus[item.id]
            const keyStatus = catalogAdminKeyStatus[item.id]
            const dirty =
              original &&
              (
                (original.officialKey || '') !== (item.officialKey || '') ||
                (original.name || '') !== (item.name || '') ||
                (original.category || '') !== (item.category || '') ||
                (original.subcategory || '') !== (item.subcategory || '') ||
                (original.brand || '') !== (item.brand || '') ||
                (original.modelName || '') !== (item.modelName || '') ||
                (original.unit || '') !== (item.unit || '')
              )

            return (
              <div key={item.id} className="row">
                <div className="row-main">
                  <strong>#{(catalogAdminPage - 1) * 20 + idx + 1}</strong>
                  <span className="pill">ID real: {item.id}</span>
                  <input
                    className="inline-input small"
                    placeholder="officialKey"
                    value={item.officialKey || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, officialKey: value } : x))
                      )
                      scheduleCatalogAdminOfficialKeyValidation(item.id, value)
                    }}
                  />
                  <input
                    className="inline-input"
                    placeholder="Nombre"
                    value={item.name || ''}
                    onChange={(e) =>
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    className="inline-input small"
                    placeholder={'Categor\u00eda'}
                    value={item.category || ''}
                    onChange={(e) =>
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, category: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    className="inline-input small"
                    placeholder={'Subcategor\u00eda'}
                    value={item.subcategory || ''}
                    onChange={(e) =>
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, subcategory: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    className="inline-input small"
                    placeholder="Marca"
                    value={item.brand || ''}
                    onChange={(e) =>
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, brand: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    className="inline-input small"
                    placeholder="Modelo"
                    value={item.modelName || ''}
                    onChange={(e) =>
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, modelName: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    className="inline-input small"
                    placeholder="Unidad"
                    value={item.unit || ''}
                    onChange={(e) =>
                      setCatalogAdminItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, unit: e.target.value } : x))
                      )
                    }
                  />
                </div>
                <div className="row-actions">
                  <button
                    onClick={() => updateCatalogAdminItem(item)}
                    disabled={
                      rowStatus?.message === 'Guardando...' ||
                      keyStatus?.message === 'Validando officialKey...' ||
                      keyStatus?.type === 'error' ||
                      !dirty ||
                      !String(item.name || '').trim() ||
                      !String(item.category || '').trim()
                    }
                  >
                    {UI_TEXT.save}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => discardCatalogAdminItem(item.id)}
                    disabled={!dirty || rowStatus?.message === 'Guardando...'}
                  >
                    {UI_TEXT.discard}
                  </button>
                  <button
                    className="danger danger-outline"
                    onClick={() =>
                      openForceDelete(
                        'catalogItem',
                        item.id,
                        `${item.name || `${UI_TEXT.itemSingular} de ${UI_TEXT.catalog.toLowerCase()}`} #${item.id}`
                      )
                    }
                  >
                    Eliminar forzado
                  </button>
                  {rowStatus?.message && (
                    <span className={rowStatus?.type === 'error' ? 'error' : 'muted'}>
                      {rowStatus?.message}
                    </span>
                  )}
                  {keyStatus?.message && (
                    <span className={keyStatus?.type === 'error' ? 'error' : 'muted'}>
                      {keyStatus?.message}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <p className="muted">{`Sin ${UI_TEXT.itemPlural} para editar.`}</p>
        )}
      </div>
      <div className="pager">
        <button
          className="ghost"
          disabled={catalogAdminPage <= 1 || catalogAdminLoading}
          onClick={() => loadCatalogAdminItems(catalogAdminPage - 1)}
        >
          {UI_TEXT.previous}
        </button>
        <span>
          {UI_TEXT.page} {catalogAdminPage} / {Math.max(1, Math.ceil(catalogAdminTotal / CATALOG_ADMIN_TAKE))}
        </span>
        <button
          className="ghost"
          disabled={
            catalogAdminLoading ||
            catalogAdminPage >= Math.max(1, Math.ceil(catalogAdminTotal / CATALOG_ADMIN_TAKE))
          }
          onClick={() => loadCatalogAdminItems(catalogAdminPage + 1)}
        >
          {UI_TEXT.next}
        </button>
      </div>
    </div>
  )
}

export default ImportsCatalogView

