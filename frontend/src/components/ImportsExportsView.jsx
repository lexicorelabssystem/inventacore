import { useMemo, useState } from 'react'

function buildAssetExportQuery(filters) {
  const params = new URLSearchParams()
  const q = String(filters.q || '').trim()
  const fromDate = String(filters.fromDate || '').trim()
  const toDate = String(filters.toDate || '').trim()

  if (q) params.set('q', q)
  if (fromDate) params.set('fromDate', fromDate)
  if (toDate) params.set('toDate', toDate)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

function ImportsExportsView(props) {
  const { downloadFile, isCentral = false } = props

  const [filters, setFilters] = useState({
    q: '',
    fromDate: '',
    toDate: '',
  })

  const assetQuery = useMemo(() => buildAssetExportQuery(filters), [filters])

  return (
    <div className="section">
      <div className="section-head">
        <h3>Exportacion masiva</h3>
      </div>

      <div className="split">
        <div className="form-card">
          <h4>Filtros para activos</h4>
          <div className="grid-form">
            <input
              placeholder="Busqueda (codigo, nombre, serie, responsable)"
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
            />
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
            />
            <p className="muted">Los reportes masivos exportan solo activos vigentes.</p>
          </div>
        </div>

        <div className="form-card">
          <h4>Exportar activos</h4>
          <p className="muted">
            Descarga masiva desde tu base local. Si no aplicas filtros, exporta todos los registros disponibles.
          </p>
          <div className="actions">
            <button
              className="primary"
              onClick={() => downloadFile(`/assets/export/excel${assetQuery}`, 'inventario.xlsx')}
            >
              Exportar Excel
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile(`/assets/export/pdf${assetQuery}`, 'inventario.pdf')}
            >
              Exportar PDF
            </button>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/assets/export/nacional/excel${assetQuery}`,
                  'inventario_nacional_consolidado.xlsx'
                )
              }
            >
              Exportar formato nacional
            </button>
          </div>
        </div>
      </div>

      {isCentral && (
        <div className="form-card" style={{ marginTop: '16px' }}>
          <h4>Exportar catalogos administrativos</h4>
          <p className="muted">
            Exportaciones globales de instituciones, establecimientos y sectores.
          </p>
          <div className="actions">
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/institutions/export/excel', 'instituciones.xlsx')}
            >
              Instituciones Excel
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/institutions/export/csv', 'instituciones.csv')}
            >
              Instituciones CSV
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/establishments/export/excel', 'establecimientos.xlsx')}
            >
              Establecimientos Excel
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/establishments/export/csv', 'establecimientos.csv')}
            >
              Establecimientos CSV
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/dependencies/export/excel', 'sectores.xlsx')}
            >
              Sectores Excel
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/dependencies/export/csv', 'sectores.csv')}
            >
              Sectores CSV
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportsExportsView
