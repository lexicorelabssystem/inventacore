import { InstitutionsTabPanel } from './tabPanels'
import { UI_TEXT } from '../constants/uiText'

function InstitutionsAdminSection({
  isCentral,
  instQuery,
  setInstQuery,
  instIncludeInactive,
  setInstIncludeInactive,
  loadInstitutions,
  downloadFile,
  dangerZoneUnlocked,
  lockDangerZoneButtons,
  unlockDangerZoneButtons,
  dangerZoneUnlocking,
  instForm,
  setInstForm,
  formErrors,
  setFormErrors,
  createInstitution,
  institutions,
  institutionsCatalog,
  instSort,
  setInstSort,
  instTotal,
  instPage,
  setInstPage,
  setInstitutions,
  instOriginal,
  updateInstitution,
  deleteInstitution,
  reactivateInstitution,
  hardDeleteInstitution,
  openForceDelete,
}) {
  return (
    <InstitutionsTabPanel>
      <div className="section module-section module-section-assistant">
        <div className="section-head">
          <h3>Instituciones</h3>
          <div className="actions">
            {isCentral ? (
              <>
                <input
                  placeholder="Buscar..."
                  value={instQuery}
                  onChange={(e) => setInstQuery(e.target.value)}
                />
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={instIncludeInactive}
                    onChange={(e) => {
                      setInstIncludeInactive(e.target.checked)
                      loadInstitutions(1)
                    }}
                  />
                  Mostrar inactivos
                </label>
                <button onClick={() => loadInstitutions(1)}>{UI_TEXT.updating}</button>
                <button
                  className="ghost"
                  onClick={() =>
                    downloadFile('/admin/institutions/export/excel', 'institutions.xlsx')
                  }
                >
                  Exportar Excel
                </button>
                <button
                  className="ghost"
                  onClick={() => downloadFile('/admin/institutions/export/csv', 'institutions.csv')}
                >
                  Exportar CSV
                </button>
              </>
            ) : (
              <span className="muted">Vista solo lectura</span>
            )}
          </div>
        </div>
        {isCentral && instQuery && (
          <div className="chip-row">
            <span className="chip">
              {UI_TEXT.search}: {instQuery}
              <button onClick={() => setInstQuery('')}>x</button>
            </span>
          </div>
        )}
        {isCentral && (
          <div className="split">
            <div className="form-card">
              <h4>Nueva institución</h4>
              <div className="actions">
                <button
                  className={dangerZoneUnlocked ? 'ghost' : 'primary'}
                  onClick={dangerZoneUnlocked ? lockDangerZoneButtons : unlockDangerZoneButtons}
                  disabled={dangerZoneUnlocking}
                >
                  {dangerZoneUnlocking
                    ? 'Verificando...'
                    : dangerZoneUnlocked
                      ? 'Bloquear acciones críticas'
                      : 'Habilitar acciones críticas'}
                </button>
              </div>
              <input
                placeholder="Nombre"
                value={instForm.name}
                onChange={(e) => {
                  setInstForm({ name: e.target.value })
                  if (formErrors.instName) {
                    setFormErrors((prev) => ({ ...prev, instName: '' }))
                  }
                }}
              />
              {formErrors.instName && <p className="error">{formErrors.instName}</p>}
              <button
                className="primary"
                onClick={createInstitution}
                disabled={!dangerZoneUnlocked}
                title={!dangerZoneUnlocked ? 'Primero habilita las acciones críticas.' : ''}
              >
                Crear
              </button>
            </div>
          </div>
        )}
        <div className="table">
          <div className="table-head">
            <div className="sort-controls">
              <label>Orden</label>
              <select
                value={instSort.key}
                onChange={(e) => setInstSort((state) => ({ ...state, key: e.target.value }))}
              >
                <option value="name">Nombre</option>
              </select>
              <button
                className="ghost"
                onClick={() =>
                  setInstSort((state) => ({
                    ...state,
                    order: state.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                {instSort.order === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <span className="muted">
              {isCentral
                ? `Mostrando ${institutions.length} de ${instTotal}`
                : `Mostrando ${institutionsCatalog.length}`}
            </span>
          </div>
          {[...(isCentral ? institutions : institutionsCatalog)]
            .sort((a, b) => {
              const dir = instSort.order === 'asc' ? 1 : -1
              return a.name.localeCompare(b.name) * dir
            })
            .map((institution, idx) => (
              <div key={institution.id} className="row">
                <div className="row-main">
                  <strong>#{isCentral ? (instPage - 1) * 20 + idx + 1 : idx + 1}</strong>
                  <span className="pill">ID real: {institution.id}</span>
                  {!institution.isActive && <span className="pill danger-pill">INACTIVA</span>}
                  {isCentral ? (
                    <input
                      className="inline-input"
                      value={institution.name}
                      onChange={(e) => {
                        const next = institutions.map((item) =>
                          item.id === institution.id ? { ...item, name: e.target.value } : item
                        )
                        setInstitutions(next)
                      }}
                    />
                  ) : (
                    <span>{institution.name}</span>
                  )}
                </div>
                {isCentral && (
                  <div className="row-actions">
                    <button
                      disabled={
                        !instOriginal[institution.id] ||
                        instOriginal[institution.id].name === institution.name
                      }
                      onClick={() =>
                        updateInstitution({
                          id: institution.id,
                          name: institution.name,
                        })
                      }
                    >
                      {UI_TEXT.save}
                    </button>
                    {institution.isActive ? (
                      <button className="danger" onClick={() => deleteInstitution(institution.id)}>
                        Dar de baja
                      </button>
                    ) : (
                      <>
                        <button onClick={() => reactivateInstitution(institution.id)}>
                          Reactivar
                        </button>
                        <button
                          className="danger"
                          onClick={() => hardDeleteInstitution(institution.id)}
                        >
                          Eliminar definitivo
                        </button>
                        <button
                          className="danger danger-outline"
                          onClick={() =>
                            openForceDelete('institution', institution.id, institution.name)
                          }
                        >
                          Eliminar forzado
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          {isCentral && !institutions.length && <p className="muted">Sin resultados.</p>}
          {!isCentral && !institutionsCatalog.length && <p className="muted">Sin resultados.</p>}
        </div>
        {isCentral && (
          <div className="pager">
            <button
              className="ghost"
              disabled={instPage <= 1}
              onClick={() => {
                const next = instPage - 1
                setInstPage(next)
                loadInstitutions(next)
              }}
            >
              {UI_TEXT.previous}
            </button>
            <span>
              {UI_TEXT.page} {instPage} / {Math.max(1, Math.ceil(instTotal / 10))}
            </span>
            <button
              className="ghost"
              disabled={instPage >= Math.ceil(instTotal / 10)}
              onClick={() => {
                const next = instPage + 1
                setInstPage(next)
                loadInstitutions(next)
              }}
            >
              {UI_TEXT.next}
            </button>
          </div>
        )}
      </div>
    </InstitutionsTabPanel>
  )
}

export default InstitutionsAdminSection
