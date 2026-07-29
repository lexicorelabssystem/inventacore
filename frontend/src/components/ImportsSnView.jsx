import { UI_TEXT } from '../constants/uiText'

function ImportsSnView(props) {
  const {
    handleSnBaseFileChange,
    snBaseFile,
    snBaseParsed,
    snBaseImporting,
    handleSnBaseImportToCatalog,
    snBaseLoading,
    snBaseImportResult,
  } = props

  return (
    <div className="section">
      <div className="section-head">
        <h3>Base SN (Insumos)</h3>
      </div>
      <div className="split">
        <div className="form-card upload-card">
          <h4>Cargar archivo SN</h4>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => handleSnBaseFileChange(e.target.files?.[0] || null)}
          />
          <p className="muted">
            {'Formato detectado: bloques de Insumo/Cantidad por categor\u00eda en una misma hoja.'}
          </p>
          {snBaseFile && <p className="muted">Archivo: {snBaseFile.name}</p>}
          <button
            className="primary"
            disabled={!snBaseParsed?.catalogItems?.length || snBaseImporting}
            onClick={handleSnBaseImportToCatalog}
          >
            {snBaseImporting ? 'Importando...' : `Convertir e importar a ${UI_TEXT.catalog.toLowerCase()}`}
          </button>
        </div>
        <div className="form-card">
          <h4>Resumen Base SN</h4>
          {snBaseLoading ? (
            <p className="muted">{UI_TEXT.loading.replace('Cargando', 'Analizando archivo')}</p>
          ) : snBaseParsed ? (
            <div className="import-summary">
              <p>Filas analizadas: <strong>{snBaseParsed.rowsRead}</strong></p>
              <p>Bloques detectados: <strong>{snBaseParsed.blockCount}</strong></p>
              <p>{'Insumos \u00fanicos: '}<strong>{snBaseParsed?.items?.length || 0}</strong></p>
            </div>
          ) : (
            <p className="muted">{'A\u00fan no se ha cargado una base SN.'}</p>
          )}
          {snBaseImportResult && (
            <div className="import-summary" style={{ marginTop: '12px' }}>
              <p>
                Creados en {UI_TEXT.catalog.toLowerCase()}: <strong>{snBaseImportResult.createdCount || 0}</strong>
              </p>
              <p>Omitidos: <strong>{snBaseImportResult.skippedCount || 0}</strong></p>
            </div>
          )}
        </div>
      </div>
      {snBaseParsed?.items?.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>{'Previsualizaci\u00f3n consolidada'}</h4>
            <span className="muted">Mostrando hasta 100 filas</span>
          </div>
          {snBaseParsed.items.slice(0, 100).map((item, idx) => (
            <div key={`sn-row-${idx}`} className="row">
              <div>
                <strong>{item.category}</strong>
                <span className="muted"> - {item.name}</span>
              </div>
              <div className="muted">Cantidad total: {item.quantity}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImportsSnView

