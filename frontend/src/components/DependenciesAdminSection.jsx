import { DependenciesTabPanel } from './tabPanels'
import { UI_TEXT } from '../constants/uiText'

function DependenciesAdminSection({
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
}) {
  return (
    <DependenciesTabPanel>
      <div className="section">
        <div className="section-head">
          <h3>Sectores</h3>
          <div className="actions">
            <input
              placeholder="Buscar..."
              value={depFilters.q}
              onChange={(e) => setDepFilters({ ...depFilters, q: e.target.value })}
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={depIncludeInactive}
                onChange={(e) => {
                  setDepIncludeInactive(e.target.checked)
                  loadDependencies(1)
                }}
              />
              Mostrar inactivos
            </label>
            <select
              value={depFilters.establishmentId}
              onChange={(e) =>
                setDepFilters({ ...depFilters, establishmentId: e.target.value })
              }
            >
              <option value="">Todos los establecimientos</option>
              {establishmentsCatalog.map((establishment) => (
                <option key={establishment.id} value={establishment.id}>
                  {establishment.name}
                </option>
              ))}
            </select>
            <button onClick={() => loadDependencies(1)}>{UI_TEXT.updating}</button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/dependencies/export/excel', 'sectores.xlsx')}
            >
              Exportar Excel
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/dependencies/export/csv', 'sectores.csv')}
            >
              Exportar CSV
            </button>
          </div>
        </div>
        {(depFilters.q || depFilters.establishmentId) && (
          <div className="chip-row">
            {depFilters.q && (
              <span className="chip">
                {UI_TEXT.search}: {depFilters.q}
                <button onClick={() => setDepFilters({ ...depFilters, q: '' })}>x</button>
              </span>
            )}
            {depFilters.establishmentId && (
              <span className="chip">
                Establecimiento:{' '}
                {establishmentsCatalog.find(
                  (establishment) =>
                    String(establishment.id) === String(depFilters.establishmentId)
                )?.name || depFilters.establishmentId}
                <button onClick={() => setDepFilters({ ...depFilters, establishmentId: '' })}>
                  x
                </button>
              </span>
            )}
          </div>
        )}
        <div className="split">
          <div className="form-card">
            <h4>Nuevo sector</h4>
            <input
              placeholder="Nombre"
              value={depForm.name}
              onChange={(e) => setDepForm({ ...depForm, name: e.target.value })}
            />
            {formErrors.depName && <p className="error">{formErrors.depName}</p>}
            <div className="select-wrap">
              <input
                className="select-search"
                placeholder="Buscar establecimiento..."
                value={depFilters.establishmentSearch || ''}
                onChange={(e) =>
                  setDepFilters({
                    ...depFilters,
                    establishmentSearch: e.target.value,
                  })
                }
              />
              <select
                value={depForm.establishmentId}
                onChange={(e) => setDepForm({ ...depForm, establishmentId: e.target.value })}
                disabled={loadingEstablishments || establishmentsCatalog.length === 0}
              >
                <option value="">
                  {loadingEstablishments ? UI_TEXT.loading : 'Selecciona establecimiento'}
                </option>
                {establishmentsCatalog
                  .filter((establishment) =>
                    depFilters.establishmentSearch
                      ? establishment.name
                          .toLowerCase()
                          .includes(depFilters.establishmentSearch.toLowerCase())
                      : true
                  )
                  .map((establishment) => (
                    <option key={establishment.id} value={establishment.id}>
                      {establishment.name}
                    </option>
                  ))}
              </select>
            </div>
            {formErrors.depEstablishmentId && (
              <p className="error">{formErrors.depEstablishmentId}</p>
            )}
            <button className="primary" onClick={createDependency}>
              Crear
            </button>
          </div>
          <div className="form-card">
            <h4>Replicar sectores base</h4>
            <p className="muted">
              Copia sectores desde un establecimiento origen a uno destino, sin duplicar nombres
              existentes.
            </p>
            <div className="select-wrap">
              <label>Establecimiento origen</label>
              <select
                value={depReplicateForm.sourceEstablishmentId}
                onChange={(e) =>
                  setDepReplicateForm((prev) => ({
                    ...prev,
                    sourceEstablishmentId: e.target.value,
                  }))
                }
              >
                <option value="">Selecciona origen</option>
                {establishmentsCatalog.map((establishment) => (
                  <option key={`dep-repl-src-${establishment.id}`} value={establishment.id}>
                    {establishment.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="select-wrap">
              <label>Establecimiento destino</label>
              <select
                value={depReplicateForm.targetEstablishmentId}
                onChange={(e) =>
                  setDepReplicateForm((prev) => ({
                    ...prev,
                    targetEstablishmentId: e.target.value,
                  }))
                }
              >
                <option value="">Selecciona destino</option>
                {establishmentsCatalog.map((establishment) => (
                  <option key={`dep-repl-dst-${establishment.id}`} value={establishment.id}>
                    {establishment.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={depReplicateForm.includeInactive}
                onChange={(e) =>
                  setDepReplicateForm((prev) => ({
                    ...prev,
                    includeInactive: e.target.checked,
                  }))
                }
              />
              Incluir sectores inactivos del origen
            </label>
            <button className="primary" onClick={replicateDependenciesFromBase}>
              Replicar
            </button>
            {depReplicateResult && (
              <div className="import-summary">
                <span className="pill">
                  Origen: {depReplicateResult.sourceEstablishmentName}
                </span>
                <span className="pill">
                  Destino: {depReplicateResult.targetEstablishmentName}
                </span>
                <span className="pill">Base: {depReplicateResult.sourceCount}</span>
                <span className="pill">Creadas: {depReplicateResult.createdCount}</span>
                <span className="pill">Omitidas: {depReplicateResult.skippedCount}</span>
                {depReplicateResult.skippedCount > 0 && (
                  <div className="muted">
                    Omitidas (duplicadas u otras):{' '}
                    {depReplicateResult.skipped
                      .slice(0, 10)
                      .map((item) => `${item.name || '-'} [${item.reason || 'SKIPPED'}]`)
                      .join(' - ')}
                    {depReplicateResult.skipped.length > 10 ? ' - ...' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <div className="sort-controls">
              <label>Orden</label>
              <select
                value={depSort.key}
                onChange={(e) => setDepSort((state) => ({ ...state, key: e.target.value }))}
              >
                <option value="name">Nombre</option>
                <option value="establishmentId">Establecimiento</option>
              </select>
              <button
                className="ghost"
                onClick={() =>
                  setDepSort((state) => ({
                    ...state,
                    order: state.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                {depSort.order === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <span className="muted">
              Mostrando {dependencies.length} de {depTotal}
            </span>
          </div>
          {[...dependencies]
            .sort((a, b) => {
              const dir = depSort.order === 'asc' ? 1 : -1
              if (depSort.key === 'establishmentId') {
                return (a.establishmentId - b.establishmentId) * dir
              }
              return a.name.localeCompare(b.name) * dir
            })
            .map((dependency, idx) => (
              <div key={dependency.id} className="row">
                <div className="row-main">
                  <strong>#{(depPage - 1) * 20 + idx + 1}</strong>
                  <span className="pill">ID real: {dependency.id}</span>
                  {!dependency.isActive && <span className="pill danger-pill">INACTIVA</span>}
                  <input
                    className="inline-input"
                    value={dependency.name}
                    onChange={(evt) => {
                      const next = dependencies.map((item) =>
                        item.id === dependency.id ? { ...item, name: evt.target.value } : item
                      )
                      setDependencies(next)
                    }}
                  />
                  <span className="pill">
                    {establishmentsCatalog.find(
                      (establishment) =>
                        Number(establishment.id) === Number(dependency.establishmentId)
                    )?.name || `Est ${dependency.establishmentId}`}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    disabled={
                      !depOriginal[dependency.id] ||
                      (depOriginal[dependency.id].name === dependency.name &&
                        depOriginal[dependency.id].establishmentId === dependency.establishmentId)
                    }
                    onClick={() =>
                      updateDependency({
                        id: dependency.id,
                        name: dependency.name,
                        establishmentId: dependency.establishmentId,
                      })
                    }
                  >
                    {UI_TEXT.save}
                  </button>
                  {dependency.isActive ? (
                    <button className="danger" onClick={() => deleteDependency(dependency.id)}>
                      Dar de baja
                    </button>
                  ) : (
                    <>
                      <button onClick={() => reactivateDependency(dependency.id)}>
                        Reactivar
                      </button>
                      <button
                        className="danger"
                        onClick={() => hardDeleteDependency(dependency.id)}
                      >
                        Eliminar definitivo
                      </button>
                      <button
                        className="danger danger-outline"
                        onClick={() =>
                          openForceDelete('dependency', dependency.id, dependency.name)
                        }
                      >
                        Eliminar forzado
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          {!dependencies.length && <p className="muted">Sin resultados.</p>}
        </div>
        <div className="pager">
          <button
            className="ghost"
            disabled={depPage <= 1}
            onClick={() => {
              const next = depPage - 1
              setDepPage(next)
              loadDependencies(next)
            }}
          >
            {UI_TEXT.previous}
          </button>
          <span>
            {UI_TEXT.page} {depPage} / {Math.max(1, Math.ceil(depTotal / 10))}
          </span>
          <button
            className="ghost"
            disabled={depPage >= Math.ceil(depTotal / 10)}
            onClick={() => {
              const next = depPage + 1
              setDepPage(next)
              loadDependencies(next)
            }}
          >
            {UI_TEXT.next}
          </button>
        </div>
      </div>
    </DependenciesTabPanel>
  )
}

export default DependenciesAdminSection
