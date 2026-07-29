import { EstablishmentsTabPanel } from './tabPanels'
import { UI_TEXT } from '../constants/uiText'

function EstablishmentsAdminSection({
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
}) {
  return (
    <EstablishmentsTabPanel>
      <div className="section module-section module-section-trash">
        <div className="section-head">
          <h3>Establecimientos</h3>
          <div className="actions">
            <input
              placeholder="Buscar..."
              value={estFilters.q}
              onChange={(e) => setEstFilters({ ...estFilters, q: e.target.value })}
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={estIncludeInactive}
                onChange={(e) => {
                  setEstIncludeInactive(e.target.checked)
                  loadEstablishments(1)
                }}
              />
              Mostrar inactivos
            </label>
            <input
              placeholder="Institution ID"
              value={estFilters.institutionId}
              onChange={(e) => setEstFilters({ ...estFilters, institutionId: e.target.value })}
            />
            <button onClick={() => loadEstablishments(1)}>{UI_TEXT.updating}</button>
            <button
              className="ghost"
              onClick={() =>
                downloadFile('/admin/establishments/export/excel', 'establishments.xlsx')
              }
            >
              Exportar Excel
            </button>
            <button
              className="ghost"
              onClick={() => downloadFile('/admin/establishments/export/csv', 'establishments.csv')}
            >
              Exportar CSV
            </button>
          </div>
        </div>
        {(estFilters.q || estFilters.institutionId) && (
          <div className="chip-row">
            {estFilters.q && (
              <span className="chip">
                {UI_TEXT.search}: {estFilters.q}
                <button onClick={() => setEstFilters({ ...estFilters, q: '' })}>x</button>
              </span>
            )}
            {estFilters.institutionId && (
              <span className="chip">
                {UI_TEXT.institution}: {estFilters.institutionId}
                <button onClick={() => setEstFilters({ ...estFilters, institutionId: '' })}>
                  x
                </button>
              </span>
            )}
          </div>
        )}
        <div className="split">
          <div className="form-card">
            <h4>Nuevo establecimiento</h4>
            <input
              placeholder="Nombre"
              value={estForm.name}
              onChange={(e) => setEstForm({ ...estForm, name: e.target.value })}
            />
            {formErrors.estName && <p className="error">{formErrors.estName}</p>}
            <input
              placeholder="Tipo"
              value={estForm.type}
              onChange={(e) => setEstForm({ ...estForm, type: e.target.value })}
            />
            {formErrors.estType && <p className="error">{formErrors.estType}</p>}
            <input
              placeholder="RBD"
              value={estForm.rbd}
              onChange={(e) => setEstForm({ ...estForm, rbd: e.target.value })}
            />
            <input
              placeholder="Comuna"
              value={estForm.commune}
              onChange={(e) => setEstForm({ ...estForm, commune: e.target.value })}
            />
            <input
              placeholder="Institution ID"
              value={estForm.institutionId}
              onChange={(e) => setEstForm({ ...estForm, institutionId: e.target.value })}
              style={{
                display: institutionsCatalog.length === 0 && !loadingInstitutions ? 'block' : 'none',
              }}
            />
            <div className="select-wrap">
              <input
                className="select-search"
                placeholder="Buscar institucion..."
                value={estFilters.institutionSearch || ''}
                onChange={(e) =>
                  setEstFilters({ ...estFilters, institutionSearch: e.target.value })
                }
              />
              <select
                value={estForm.institutionId}
                onChange={(e) => setEstForm({ ...estForm, institutionId: e.target.value })}
                disabled={loadingInstitutions || institutionsCatalog.length === 0}
              >
                <option value="">
                  {loadingInstitutions ? UI_TEXT.loading : 'Selecciona institucion'}
                </option>
                {institutionsCatalog
                  .filter((institution) =>
                    estFilters.institutionSearch
                      ? institution.name
                          .toLowerCase()
                          .includes(estFilters.institutionSearch.toLowerCase())
                      : true
                  )
                  .map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
              </select>
            </div>
            {estForm.institutionId && (
              <p className="muted">
                Comunas ya usadas en esta institucion:{' '}
                {[
                  ...new Set(
                    (establishmentsCatalog || [])
                      .map((item) => (item.commune || '').trim())
                      .filter(Boolean)
                  ),
                ].join(', ') || 'sin registro'}
              </p>
            )}
            <p className="muted">
              Nota: codigo postal aun no existe en base de datos; si lo quieres, agregamos
              migracion para guardarlo formalmente.
            </p>
            {formErrors.estInstitutionId && (
              <p className="error">{formErrors.estInstitutionId}</p>
            )}
            <button className="primary" onClick={createEstablishment}>
              Crear
            </button>
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <div className="sort-controls">
              <label>Orden</label>
              <select
                value={estSort.key}
                onChange={(e) => setEstSort((state) => ({ ...state, key: e.target.value }))}
              >
                <option value="name">Nombre</option>
                <option value="type">Tipo</option>
                <option value="institutionId">{UI_TEXT.institution}</option>
              </select>
              <button
                className="ghost"
                onClick={() =>
                  setEstSort((state) => ({
                    ...state,
                    order: state.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                {estSort.order === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <span className="muted">
              Mostrando {establishments.length} de {estTotal}
            </span>
          </div>
          {[...establishments]
            .sort((a, b) => {
              const dir = estSort.order === 'asc' ? 1 : -1
              if (estSort.key === 'type') return a.type.localeCompare(b.type) * dir
              if (estSort.key === 'institutionId') {
                return (a.institutionId - b.institutionId) * dir
              }
              return a.name.localeCompare(b.name) * dir
            })
            .map((establishment, idx) => (
              <div key={establishment.id} className="row">
                <div className="row-main">
                  <strong>#{(estPage - 1) * 20 + idx + 1}</strong>
                  <span className="pill">ID real: {establishment.id}</span>
                  {!establishment.isActive && <span className="pill danger-pill">INACTIVO</span>}
                  <input
                    className="inline-input"
                    value={establishment.name}
                    onChange={(evt) => {
                      const next = establishments.map((item) =>
                        item.id === establishment.id
                          ? { ...item, name: evt.target.value }
                          : item
                      )
                      setEstablishments(next)
                    }}
                  />
                  <input
                    className="inline-input small"
                    value={establishment.type}
                    onChange={(evt) => {
                      const next = establishments.map((item) =>
                        item.id === establishment.id
                          ? { ...item, type: evt.target.value }
                          : item
                      )
                      setEstablishments(next)
                    }}
                  />
                  <input
                    className="inline-input small"
                    value={establishment.rbd || ''}
                    onChange={(evt) => {
                      const next = establishments.map((item) =>
                        item.id === establishment.id ? { ...item, rbd: evt.target.value } : item
                      )
                      setEstablishments(next)
                    }}
                  />
                  <input
                    className="inline-input"
                    value={establishment.commune || ''}
                    onChange={(evt) => {
                      const next = establishments.map((item) =>
                        item.id === establishment.id
                          ? { ...item, commune: evt.target.value }
                          : item
                      )
                      setEstablishments(next)
                    }}
                  />
                  <span className="pill">Inst {establishment.institutionId}</span>
                </div>
                <div className="row-actions">
                  <button
                    disabled={
                      !estOriginal[establishment.id] ||
                      (estOriginal[establishment.id].name === establishment.name &&
                        estOriginal[establishment.id].type === establishment.type &&
                        estOriginal[establishment.id].rbd === (establishment.rbd || '') &&
                        estOriginal[establishment.id].commune === (establishment.commune || '') &&
                        estOriginal[establishment.id].institutionId ===
                          establishment.institutionId)
                    }
                    onClick={() =>
                      updateEstablishment({
                        id: establishment.id,
                        name: establishment.name,
                        type: establishment.type,
                        rbd: establishment.rbd,
                        commune: establishment.commune,
                        institutionId: establishment.institutionId,
                      })
                    }
                  >
                    {UI_TEXT.save}
                  </button>
                  {establishment.isActive ? (
                    <button className="danger" onClick={() => deleteEstablishment(establishment.id)}>
                      Dar de baja
                    </button>
                  ) : (
                    <>
                      <button onClick={() => reactivateEstablishment(establishment.id)}>
                        Reactivar
                      </button>
                      <button
                        className="danger"
                        onClick={() => hardDeleteEstablishment(establishment.id)}
                      >
                        Eliminar definitivo
                      </button>
                      <button
                        className="danger danger-outline"
                        onClick={() =>
                          openForceDelete('establishment', establishment.id, establishment.name)
                        }
                      >
                        Eliminar forzado
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          {!establishments.length && <p className="muted">Sin resultados.</p>}
        </div>
        <div className="pager">
          <button
            className="ghost"
            disabled={estPage <= 1}
            onClick={() => {
              const next = estPage - 1
              setEstPage(next)
              loadEstablishments(next)
            }}
          >
            {UI_TEXT.previous}
          </button>
          <span>
            {UI_TEXT.page} {estPage} / {Math.max(1, Math.ceil(estTotal / 10))}
          </span>
          <button
            className="ghost"
            disabled={estPage >= Math.ceil(estTotal / 10)}
            onClick={() => {
              const next = estPage + 1
              setEstPage(next)
              loadEstablishments(next)
            }}
          >
            {UI_TEXT.next}
          </button>
        </div>
      </div>
    </EstablishmentsTabPanel>
  )
}

export default EstablishmentsAdminSection
