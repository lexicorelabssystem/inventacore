import { UI_TEXT } from '../constants/uiText'

function ImportsAssetsView(props) {
  const {
    downloadFile,
    purgeAssetsAllWithReset,
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
  } = props
  const importMetrics = importResult?.metrics || null
  const importTotalSeconds = importMetrics
    ? Math.max(0.1, Number(importMetrics.totalMs || 0) / 1000)
    : 0
  const importAssetsPerSecond = importMetrics
    ? ((Number(importResult?.createdCount || 0) / importTotalSeconds) || 0).toFixed(2)
    : null
  const importProgressValue = importMetrics
    ? Math.min(Number(importMetrics.totalRows || 0), Number(importMetrics.processedRows || 0))
    : 0
  const importProgressTotal = importMetrics ? Math.max(0, Number(importMetrics.totalRows || 0)) : 0
  const importProgressPercent = importProgressTotal
    ? Math.min(100, Math.round((importProgressValue / importProgressTotal) * 100))
    : 0

  return (
    <div className="section">
      <div className="section-head">
        <h3>Carga Masiva (Excel)</h3>
        <div className="actions">
          <button
            className="ghost"
            onClick={() => downloadFile('/assets/import/template/excel', 'carga_masiva_activo_fijo.xlsx')}
          >
            Descargar plantilla Activo fijo
          </button>
          <button
            className="ghost"
            onClick={() => downloadFile('/assets/import/catalog/excel', 'assets_catalog_ids.xlsx')}
          >
            Descargar IDs
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
            onClick={purgeAssetsAllWithReset}
            disabled={!dangerZoneUnlocked}
            title={!dangerZoneUnlocked ? 'Primero habilita las acciones críticas.' : ''}
          >
            Vaciar activos (ID=1)
          </button>
          <button
            className="danger danger-outline"
            onClick={() => purgeAssetsAllWithReset({ forceStructureDelete: true })}
            disabled={!dangerZoneUnlocked}
            title={!dangerZoneUnlocked ? 'Primero habilita las acciones críticas.' : ''}
          >
            Vaciar + borrar deps/est
          </button>
        </div>
      </div>
      <div className="split">
        <div className="form-card upload-card">
          <h4>Subir archivo</h4>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setImportFile(file)
              handlePreviewFile(file)
            }}
          />
          <p className="muted">
            {'El sistema detecta la fila que contiene Codigo, Nombre y Cantidad; importa desde la fila siguiente. Codigo VAL debe tener formato VAL + 7 d\u00edgitos y no puede repetirse.'}
          </p>
          {importLoading && (
            <p className="muted">
              {'Procesando importaci\u00f3n. Esto puede tardar varios segundos o minutos seg\u00fan el tama\u00f1o del archivo.'}
            </p>
          )}
          <button className="primary" onClick={handleImportUpload} disabled={importLoading}>
            {importLoading ? 'Importando...' : 'Importar Excel'}
          </button>
        </div>
        <div className="form-card">
          <h4>Resultado</h4>
          {importResult ? (
            <div className="import-summary">
              {importResult.status && (
                <p>
                  Estado: <strong>{importResult.status}</strong>
                </p>
              )}
              <p>
                Creados: <strong>{importResult.createdCount}</strong>
              </p>
              <p>
                {UI_TEXT.errors}: <strong>{importResult.errorCount}</strong>
              </p>
              {importMetrics && (
                <>
                  <p>
                    Filas procesadas: <strong>{importMetrics.processedRows}</strong>
                    {importProgressTotal > 0 ? (
                      <>
                        {' '}
                        / <strong>{importProgressTotal}</strong>
                      </>
                    ) : null}
                  </p>
                  {importProgressTotal > 0 && (
                    <>
                      <progress
                        max={importProgressTotal}
                        value={importProgressValue}
                        style={{ width: '100%' }}
                      />
                      <p>
                        Avance: <strong>{importProgressPercent}%</strong>
                      </p>
                    </>
                  )}
                  <p>
                    Ruta r\u00e1pida: <strong>{importMetrics.fastPathRows}</strong> filas /{" "}
                    <strong>{importMetrics.fastPathAssets}</strong> activos
                  </p>
                  <p>
                    Ruta normal: <strong>{importMetrics.standardRows}</strong> filas /{" "}
                    <strong>{importMetrics.standardAssets}</strong> activos
                  </p>
                  <p>
                    Tiempo total: <strong>{importMetrics.totalMs} ms</strong> (
                    <strong>{importTotalSeconds.toFixed(1)} s</strong>)
                  </p>
                  <p>
                    Rendimiento: <strong>{importAssetsPerSecond}</strong> activos/seg
                  </p>
                </>
              )}
              {importResult.canResume && (
                <button
                  className="ghost"
                  onClick={() => resumeImportJob(importResult.id)}
                  disabled={importLoading}
                >
                  Reanudar importaci\u00f3n
                </button>
              )}
            </div>
          ) : (
            <p className="muted">{'A\u00fan no hay importaci\u00f3n.'}</p>
          )}
        </div>
      </div>
      {importSchemaDetails?.missingColumns && (
        <div className="alert">
          <strong>Faltan columnas:</strong> {importSchemaDetails.missingColumns.join(', ')}
        </div>
      )}
      {previewHeaders.length > 0 && (
        <div className="preview">
          <div className="table-head">
            <h4>Preview</h4>
            {previewMissing.length > 0 && (
              <span className="muted">Faltan: {previewMissing.join(', ')}</span>
            )}
          </div>
          <div className="preview-table">
            <div className="preview-row header">
              {previewHeaders.map((h, idx) => (
                <div key={`ph-${idx}`} className="preview-cell">
                  {String(h)}
                </div>
              ))}
            </div>
            {previewRows.map((row, idx) => {
              const invalidCols = previewInvalidCells[idx + 1] || []
              return (
                <div key={`pr-${idx}`} className="preview-row">
                  {row.map((cell, cidx) => (
                    <div
                      key={`pc-${idx}-${cidx}`}
                      className={`preview-cell${invalidCols.includes(cidx) ? ' invalid' : ''}`}
                    >
                      {String(cell)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {importErrors.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Errores por fila</h4>
            <span className="muted">Corrige y vuelve a importar</span>
          </div>
          {importErrors.map((err, idx) => (
            <div key={`imp-${idx}`} className="row">
              <div>
                <strong>Fila {err.row}</strong>
                {err.fields?.length ? <span className="muted"> - {err.fields.join(', ')}</span> : null}
              </div>
              <div className="muted">{err.error}</div>
            </div>
          ))}
        </div>
      )}
      <div className="section-head" style={{ marginTop: '16px' }}>
        <h4>Historial de importaciones</h4>
        <div className="actions">
          <input
            type="date"
            value={importHistoryFilters.fromDate}
            onChange={(e) =>
              setImportHistoryFilters({
                ...importHistoryFilters,
                fromDate: e.target.value,
              })
            }
          />
          <input
            type="date"
            value={importHistoryFilters.toDate}
            onChange={(e) =>
              setImportHistoryFilters({
                ...importHistoryFilters,
                toDate: e.target.value,
              })
            }
          />
          <input
            placeholder="User ID"
            value={importHistoryFilters.userId}
            onChange={(e) =>
              setImportHistoryFilters({
                ...importHistoryFilters,
                userId: e.target.value,
              })
            }
            style={{ maxWidth: '140px' }}
          />
          <button className="ghost" onClick={() => loadImportHistory(1)}>
            {UI_TEXT.updating}
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = new URLSearchParams()
              if (importHistoryFilters.fromDate) params.set('fromDate', importHistoryFilters.fromDate)
              if (importHistoryFilters.toDate) params.set('toDate', importHistoryFilters.toDate)
              if (importHistoryFilters.userId) params.set('userId', importHistoryFilters.userId)
              const qs = params.toString()
              downloadFile(`/assets/imports/export/excel${qs ? `?${qs}` : ''}`, 'import_history.xlsx')
            }}
          >
            Exportar Excel
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = new URLSearchParams()
              if (importHistoryFilters.fromDate) params.set('fromDate', importHistoryFilters.fromDate)
              if (importHistoryFilters.toDate) params.set('toDate', importHistoryFilters.toDate)
              if (importHistoryFilters.userId) params.set('userId', importHistoryFilters.userId)
              const qs = params.toString()
              downloadFile(`/assets/imports/export/pdf${qs ? `?${qs}` : ''}`, 'import_history.pdf')
            }}
          >
            Exportar PDF
          </button>
        </div>
      </div>
      {importHistoryLoading && <p className="muted">{UI_TEXT.loading}</p>}
      {!importHistoryLoading && (
        <div className="table">
          {importHistory.map((batch) => (
            <div key={batch.id} className="row">
              <div>
                <strong>{batch.filename}</strong>
                <span className="muted"> - {new Date(batch.createdAt).toLocaleString()}</span>
              </div>
              <div className="row-actions">
                <span className="pill">{batch.status}</span>
                <span className="pill">Creados: {batch.createdCount}</span>
                <span className="pill">{UI_TEXT.errors}: {batch.errorCount}</span>
                {batch.errors && (
                  <button
                    className="ghost"
                    onClick={() =>
                      setImportHistoryOpen(
                        importHistoryOpen && importHistoryOpen.id === batch.id ? null : batch
                      )
                    }
                  >
                    Ver errores
                  </button>
                )}
                {batch.status === 'COMPLETED' &&
                  batch.errors?.meta?.tempFilePath &&
                  batch.errors?.items?.some((item) => item?.imported !== true) && (
                    <button
                      className="ghost"
                      disabled={importLoading}
                      onClick={() => resumeImportJob(batch.id)}
                    >
                      Incorporar filas con error
                    </button>
                  )}
              </div>
            </div>
          ))}
          {!importHistory.length && <p className="muted">{UI_TEXT.noHistory}</p>}
        </div>
      )}
      <div className="pager">
        <button
          className="ghost"
          disabled={importHistoryPage <= 1}
          onClick={() => loadImportHistory(importHistoryPage - 1)}
        >
          {UI_TEXT.previous}
        </button>
        <span>
          {UI_TEXT.page} {importHistoryPage} / {Math.max(1, Math.ceil(importHistoryTotal / 10))}
        </span>
        <button
          className="ghost"
          disabled={importHistoryPage >= Math.ceil(importHistoryTotal / 10)}
          onClick={() => loadImportHistory(importHistoryPage + 1)}
        >
          {UI_TEXT.next}
        </button>
      </div>
      {importHistoryOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{'Errores de importaci\u00f3n'}</h3>
            <pre className="code-block">{JSON.stringify(importHistoryOpen.errors, null, 2)}</pre>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setImportHistoryOpen(null)}>
                {UI_TEXT.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportsAssetsView


