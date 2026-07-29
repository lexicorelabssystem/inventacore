import { UsersTabPanel } from './tabPanels'
import { UI_TEXT } from '../constants/uiText'

function UsersAdminSection({
  userFilters,
  setUserFilters,
  loadUsersAdmin,
  userForm,
  setUserForm,
  userInstitutionOptions,
  userEstablishmentOptions,
  userFormWithoutPhoto,
  setUserFormWithoutPhoto,
  setUserFormPhotoFile,
  createUserAdmin,
  users,
  usersTotal,
  usersLoading,
  usersPage,
  setUsersPage,
  setUsers,
  usersOriginal,
  currentUser,
  userPhotoFiles,
  setUserPhotoFiles,
  saveUserPhotoAdmin,
  clearUserPhotoAdmin,
  updateUserAdmin,
  resetUserPasswordAdmin,
  deactivateUserAdmin,
  reactivateUserAdmin,
  openForceDelete,
  setErr,
}) {
  return (
    <UsersTabPanel>
      <div className="section">
        <div className="section-head">
          <h3>Usuarios</h3>
          <div className="actions">
            <input
              placeholder="Buscar por nombre/email..."
              value={userFilters.q}
              onChange={(e) => setUserFilters({ ...userFilters, q: e.target.value })}
            />
            <select
              value={userFilters.roleType}
              onChange={(e) =>
                setUserFilters({ ...userFilters, roleType: e.target.value })
              }
            >
              <option value="">Todos los roles</option>
              <option value="ADMIN_CENTRAL">ADMIN_CENTRAL</option>
              <option value="ADMIN_ESTABLISHMENT">ADMIN_ESTABLISHMENT</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <input
              placeholder="Institution ID"
              value={userFilters.institutionId}
              onChange={(e) =>
                setUserFilters({
                  ...userFilters,
                  institutionId: e.target.value.replace(/\D/g, ''),
                })
              }
            />
            <input
              placeholder="Establishment ID"
              value={userFilters.establishmentId}
              onChange={(e) =>
                setUserFilters({
                  ...userFilters,
                  establishmentId: e.target.value.replace(/\D/g, ''),
                })
              }
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={userFilters.includeInactive}
                onChange={(e) =>
                  setUserFilters({
                    ...userFilters,
                    includeInactive: e.target.checked,
                  })
                }
              />
              Mostrar inactivos
            </label>
            <button onClick={() => loadUsersAdmin(1)}>{UI_TEXT.updating}</button>
          </div>
        </div>

        <div className="split">
          <div className="form-card">
            <h4>Crear usuario</h4>
            <input
              placeholder="Nombre *"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            />
            <input
              placeholder="Email *"
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            />
            <input
              placeholder="Password *"
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
            <select
              value={userForm.roleType}
              onChange={(e) =>
                setUserForm((prev) => ({
                  ...prev,
                  roleType: e.target.value,
                  institutionId: e.target.value === 'ADMIN_CENTRAL' ? prev.institutionId : '',
                  establishmentId:
                    e.target.value === 'ADMIN_CENTRAL' ? '' : prev.establishmentId,
                }))
              }
            >
              <option value="ADMIN_ESTABLISHMENT">ADMIN_ESTABLISHMENT</option>
              <option value="VIEWER">VIEWER</option>
              <option value="ADMIN_CENTRAL">ADMIN_CENTRAL</option>
            </select>
            <select
              value={userForm.institutionId}
              onChange={(e) =>
                setUserForm({
                  ...userForm,
                  institutionId: e.target.value,
                })
              }
              disabled={userForm.roleType !== 'ADMIN_CENTRAL'}
            >
              <option value="">Selecciona institucion</option>
              {userInstitutionOptions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  #{inst.id} - {inst.name}
                </option>
              ))}
            </select>
            <select
              value={userForm.establishmentId}
              onChange={(e) =>
                setUserForm({
                  ...userForm,
                  establishmentId: e.target.value,
                })
              }
              disabled={userForm.roleType === 'ADMIN_CENTRAL'}
            >
              <option value="">Selecciona establecimiento</option>
              {userEstablishmentOptions.map((est) => (
                <option key={est.id} value={est.id}>
                  #{est.id} - {est.name} - Comuna: {est.commune || 's/i'} - Inst{' '}
                  {est.institutionId}
                </option>
              ))}
            </select>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={userFormWithoutPhoto}
                onChange={(e) => {
                  const checked = e.target.checked
                  setUserFormWithoutPhoto(checked)
                  if (checked) setUserFormPhotoFile(null)
                }}
              />
              Sin foto
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={userFormWithoutPhoto}
              onChange={(e) =>
                setUserFormPhotoFile(
                  e.target.files && e.target.files[0] ? e.target.files[0] : null
                )
              }
            />
            <button className="primary" onClick={createUserAdmin}>
              Crear usuario
            </button>
          </div>
        </div>

        <div className="table">
          <div className="table-head">
            <span className="muted">
              Mostrando {users.length} de {usersTotal}
            </span>
          </div>

          {usersLoading && <p className="muted">Cargando usuarios...</p>}
          {!usersLoading &&
            users.map((u, idx) => (
              <div key={u.id} className="row">
                <div className="row-main">
                  <div className="user-thumb-wrap">
                    {u.photoDataUrl ? (
                      <img className="user-thumb" src={u.photoDataUrl} alt={`Foto ${u.name}`} />
                    ) : (
                      <div className="user-thumb user-thumb-empty">Sin foto</div>
                    )}
                  </div>
                  <strong>#{(usersPage - 1) * 20 + idx + 1}</strong>
                  <span className="pill">ID real: {u.id}</span>
                  {!u.isActive && <span className="pill danger-pill">INACTIVO</span>}
                  <input
                    className="inline-input"
                    value={u.name || ''}
                    onChange={(e) => {
                      const next = users.map((x) =>
                        x.id === u.id ? { ...x, name: e.target.value } : x
                      )
                      setUsers(next)
                    }}
                  />
                  <span className="pill">{u.email}</span>
                  <select
                    value={u.roleType || ''}
                    onChange={(e) => {
                      const next = users.map((x) =>
                        x.id === u.id
                          ? {
                              ...x,
                              roleType: e.target.value,
                              establishmentId:
                                e.target.value === 'ADMIN_CENTRAL' ? '' : x.establishmentId,
                            }
                          : x
                      )
                      setUsers(next)
                    }}
                  >
                    <option value="ADMIN_CENTRAL">ADMIN_CENTRAL</option>
                    <option value="ADMIN_ESTABLISHMENT">ADMIN_ESTABLISHMENT</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  <input
                    className="inline-input small"
                    value={u.institutionId || ''}
                    onChange={(e) => {
                      const next = users.map((x) =>
                        x.id === u.id ? { ...x, institutionId: e.target.value } : x
                      )
                      setUsers(next)
                    }}
                  />
                  <select
                    className="inline-input"
                    value={u.establishmentId || ''}
                    disabled={u.roleType === 'ADMIN_CENTRAL'}
                    onChange={(e) => {
                      const next = users.map((x) =>
                        x.id === u.id ? { ...x, establishmentId: e.target.value } : x
                      )
                      setUsers(next)
                    }}
                  >
                    <option value="">Sin establecimiento</option>
                    {userEstablishmentOptions.map((est) => (
                      <option key={est.id} value={est.id}>
                        #{est.id} - {est.name} - {est.commune || 's/i'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row-actions">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) =>
                      setUserPhotoFiles((prev) => ({
                        ...prev,
                        [u.id]: e.target.files && e.target.files[0] ? e.target.files[0] : null,
                      }))
                    }
                  />
                  <button
                    className="ghost"
                    onClick={async () => {
                      try {
                        await saveUserPhotoAdmin(u.id, userPhotoFiles[u.id])
                      } catch (err) {
                        setErr(err)
                      }
                    }}
                  >
                    {UI_TEXT.savePhoto}
                  </button>
                  <button
                    className="ghost"
                    onClick={async () => {
                      try {
                        await clearUserPhotoAdmin(u.id)
                      } catch (err) {
                        setErr(err)
                      }
                    }}
                  >
                    Sin foto
                  </button>
                  <button
                    disabled={
                      !usersOriginal[u.id] ||
                      (usersOriginal[u.id].name === u.name &&
                        usersOriginal[u.id].roleType === u.roleType &&
                        String(usersOriginal[u.id].institutionId || '') ===
                          String(u.institutionId || '') &&
                        String(usersOriginal[u.id].establishmentId || '') ===
                          String(u.establishmentId || ''))
                    }
                    onClick={() => updateUserAdmin(u)}
                  >
                    {UI_TEXT.save}
                  </button>
                  <button
                    className="ghost"
                    disabled={Number(currentUser?.id) === Number(u.id)}
                    onClick={() => resetUserPasswordAdmin(u)}
                  >
                    Restablecer clave
                  </button>
                  {u.isActive ? (
                    <button
                      className="danger"
                      disabled={Number(currentUser?.id) === Number(u.id)}
                      onClick={() => deactivateUserAdmin(u.id, u.email)}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <>
                      <button className="ghost" onClick={() => reactivateUserAdmin(u.id, u.email)}>
                        Reactivar
                      </button>
                      <button
                        className="danger danger-outline"
                        disabled={Number(currentUser?.id) === Number(u.id)}
                        onClick={() => openForceDelete('user', u.id, u.email)}
                      >
                        Eliminar forzado
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          {!usersLoading && !users.length && <p className="muted">Sin resultados.</p>}
        </div>

        <div className="pager">
          <button
            className="ghost"
            disabled={usersPage <= 1}
            onClick={() => {
              const next = usersPage - 1
              setUsersPage(next)
              loadUsersAdmin(next)
            }}
          >
            {UI_TEXT.previous}
          </button>
          <span>
            {UI_TEXT.page} {usersPage} / {Math.max(1, Math.ceil(usersTotal / 10))}
          </span>
          <button
            className="ghost"
            disabled={usersPage >= Math.ceil(usersTotal / 10)}
            onClick={() => {
              const next = usersPage + 1
              setUsersPage(next)
              loadUsersAdmin(next)
            }}
          >
            {UI_TEXT.next}
          </button>
        </div>
      </div>
    </UsersTabPanel>
  )
}

export default UsersAdminSection
