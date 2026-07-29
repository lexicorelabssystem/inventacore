function AuditSection(props) {
  const {
    auditFilters,
    setAuditFilters,
    applyAuditRangePreset,
    loadAdminAudits,
    resetAdminAuditFilters,
    buildAdminAuditParams,
    downloadFile,
    adminAuditLoading,
    adminAudits,
    adminAuditTotal,
    adminAuditPage,
    auditCleanupForm,
    setAuditCleanupForm,
    runAuditCleanup,
    loginAuditFilters,
    setLoginAuditFilters,
    loadLoginAudits,
    resetLoginAuditFilters,
    buildLoginAuditParams,
    loginAuditLoading,
    loginAudits,
    loginAuditTotal,
    loginAuditPage,
    metricsFilters,
    setMetricsFilters,
    loadLoginMetrics,
    metricsTop,
    setMetricsTop,
    loginMetrics,
    loginMetricsHourly,
    hourlySort,
    setHourlySort,
    loginMetricsByIp,
    ipSort,
    setIpSort,
    loginMetricsByUser,
    userSort,
    setUserSort,
  } = props

  return (
    <div className="section">
      <div className="section-head">
        <h3>Auditoria Admin</h3>
        <div className="actions">
          <select
            value={auditFilters.entityType}
            onChange={(e) => setAuditFilters({ ...auditFilters, entityType: e.target.value })}
          >
            <option value="">Entidad</option>
            <option value="INSTITUTION">INSTITUTION</option>
            <option value="ESTABLISHMENT">ESTABLISHMENT</option>
            <option value="DEPENDENCY">DEPENDENCY</option>
            <option value="CATALOG_ITEM">CATALOG_ITEM</option>
            <option value="USER">USER</option>
          </select>
          <select
            value={auditFilters.action}
            onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
          >
            <option value="">Accion</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            type="date"
            value={auditFilters.fromDate}
            onChange={(e) => setAuditFilters({ ...auditFilters, fromDate: e.target.value })}
          />
          <input
            type="date"
            value={auditFilters.toDate}
            onChange={(e) => setAuditFilters({ ...auditFilters, toDate: e.target.value })}
          />
          <button className="ghost" onClick={() => applyAuditRangePreset('admin', 'WEEK')}>
            Semanal
          </button>
          <button className="ghost" onClick={() => applyAuditRangePreset('admin', 'MONTH')}>
            Mensual
          </button>
          <button className="ghost" onClick={() => applyAuditRangePreset('admin', 'YEAR')}>
            Anual
          </button>
          <button onClick={() => loadAdminAudits(1)}>Actualizar</button>
          <button className="ghost" onClick={resetAdminAuditFilters}>
            Reset
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = buildAdminAuditParams()
              const qs = params.toString()
              downloadFile(`/admin/audit/export/excel${qs ? `?${qs}` : ''}`, 'admin_audit.xlsx')
            }}
          >
            Exportar Excel
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = buildAdminAuditParams()
              const qs = params.toString()
              downloadFile(`/admin/audit/export/csv${qs ? `?${qs}` : ''}`, 'admin_audit.csv')
            }}
          >
            Exportar CSV
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = buildAdminAuditParams()
              const qs = params.toString()
              downloadFile(`/admin/audit/export/pdf${qs ? `?${qs}` : ''}`, 'admin_audit.pdf')
            }}
          >
            Exportar PDF
          </button>
        </div>
      </div>
      <div className="table">
        <div className="table-head">
          <span className="muted">
            {adminAuditLoading ? 'Cargando...' : `Mostrando ${adminAudits.length} de ${adminAuditTotal}`}
          </span>
        </div>
        {adminAudits.map((a) => (
          <div key={a.id} className="row">
            <div>
              <strong>{a.action}</strong> {a.entityType} #{a.entityId}
            </div>
            <div className="muted">
              {a.user?.name} · {new Date(a.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
        {!adminAuditLoading && !adminAudits.length && <p className="muted">Sin resultados.</p>}
        <div className="pagination">
          <button
            className="ghost"
            disabled={adminAuditPage <= 1}
            onClick={() => loadAdminAudits(adminAuditPage - 1)}
          >
            Anterior
          </button>
          <span className="muted">
            Pagina {adminAuditPage} / {Math.max(1, Math.ceil(adminAuditTotal / 20))}
          </span>
          <button
            className="ghost"
            disabled={adminAuditPage >= Math.ceil(adminAuditTotal / 20)}
            onClick={() => loadAdminAudits(adminAuditPage + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
      <div className="form-card" style={{ marginTop: '12px' }}>
        <h4>Limpieza / Minimizacion de Auditoria</h4>
        <div className="grid-form">
          <div className="field">
            <label>Scope</label>
            <select
              value={auditCleanupForm.scope}
              onChange={(e) => setAuditCleanupForm((prev) => ({ ...prev, scope: e.target.value }))}
            >
              <option value="ALL">ALL (Admin + Login)</option>
              <option value="ADMIN">ADMIN</option>
              <option value="LOGIN">LOGIN</option>
            </select>
          </div>
          <div className="field">
            <label>Modo</label>
            <select
              value={auditCleanupForm.mode}
              onChange={(e) => setAuditCleanupForm((prev) => ({ ...prev, mode: e.target.value }))}
            >
              <option value="KEEP_DAYS">Mantener ultimos X dias</option>
              <option value="BEFORE_DATE">Borrar antes de fecha</option>
              <option value="DELETE_ALL">Borrar todo</option>
            </select>
          </div>
          {auditCleanupForm.mode === 'KEEP_DAYS' && (
            <div className="field">
              <label>Dias a conservar</label>
              <input
                type="number"
                min="1"
                max="3650"
                value={auditCleanupForm.keepDays}
                onChange={(e) =>
                  setAuditCleanupForm((prev) => ({ ...prev, keepDays: e.target.value }))
                }
              />
            </div>
          )}
          {auditCleanupForm.mode === 'BEFORE_DATE' && (
            <div className="field">
              <label>Fecha corte</label>
              <input
                type="date"
                value={auditCleanupForm.beforeDate}
                onChange={(e) =>
                  setAuditCleanupForm((prev) => ({ ...prev, beforeDate: e.target.value }))
                }
              />
            </div>
          )}
        </div>
        <div className="actions">
          <button className="danger" onClick={runAuditCleanup}>
            Ejecutar limpieza
          </button>
        </div>
      </div>
      <div className="section-head" style={{ marginTop: '16px' }}>
        <h3>Login Audit</h3>
        <div className="actions">
          <input
            placeholder="Email"
            value={loginAuditFilters.email}
            onChange={(e) => setLoginAuditFilters({ ...loginAuditFilters, email: e.target.value })}
          />
          <select
            value={loginAuditFilters.success}
            onChange={(e) => setLoginAuditFilters({ ...loginAuditFilters, success: e.target.value })}
          >
            <option value="">Success?</option>
            <option value="true">YES</option>
            <option value="false">NO</option>
          </select>
          <input
            type="date"
            value={loginAuditFilters.fromDate}
            onChange={(e) => setLoginAuditFilters({ ...loginAuditFilters, fromDate: e.target.value })}
          />
          <input
            type="date"
            value={loginAuditFilters.toDate}
            onChange={(e) => setLoginAuditFilters({ ...loginAuditFilters, toDate: e.target.value })}
          />
          <button className="ghost" onClick={() => applyAuditRangePreset('login', 'WEEK')}>
            Semanal
          </button>
          <button className="ghost" onClick={() => applyAuditRangePreset('login', 'MONTH')}>
            Mensual
          </button>
          <button className="ghost" onClick={() => applyAuditRangePreset('login', 'YEAR')}>
            Anual
          </button>
          <button onClick={() => loadLoginAudits(1)}>Actualizar</button>
          <button className="ghost" onClick={resetLoginAuditFilters}>
            Reset
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = buildLoginAuditParams()
              const qs = params.toString()
              downloadFile(`/admin/login-audit/export/excel${qs ? `?${qs}` : ''}`, 'login_audit.xlsx')
            }}
          >
            Exportar Excel
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = buildLoginAuditParams()
              const qs = params.toString()
              downloadFile(`/admin/login-audit/export/csv${qs ? `?${qs}` : ''}`, 'login_audit.csv')
            }}
          >
            Exportar CSV
          </button>
          <button
            className="ghost"
            onClick={() => {
              const params = buildLoginAuditParams()
              const qs = params.toString()
              downloadFile(`/admin/login-audit/export/pdf${qs ? `?${qs}` : ''}`, 'login_audit.pdf')
            }}
          >
            Exportar PDF
          </button>
        </div>
      </div>
      <div className="table">
        <div className="table-head">
          <span className="muted">
            {loginAuditLoading ? 'Cargando...' : `Mostrando ${loginAudits.length} de ${loginAuditTotal}`}
          </span>
        </div>
        {loginAudits.map((a) => (
          <div key={a.id} className="row">
            <div>
              <strong>{a.success ? 'SUCCESS' : 'FAIL'}</strong> {a.email}
            </div>
            <div className="muted">
              {a.ip} · {new Date(a.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
        {!loginAuditLoading && !loginAudits.length && <p className="muted">Sin resultados.</p>}
        <div className="pagination">
          <button
            className="ghost"
            disabled={loginAuditPage <= 1}
            onClick={() => loadLoginAudits(loginAuditPage - 1)}
          >
            Anterior
          </button>
          <span className="muted">
            Pagina {loginAuditPage} / {Math.max(1, Math.ceil(loginAuditTotal / 20))}
          </span>
          <button
            className="ghost"
            disabled={loginAuditPage >= Math.ceil(loginAuditTotal / 20)}
            onClick={() => loadLoginAudits(loginAuditPage + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
      <div className="section-head" style={{ marginTop: '16px' }}>
        <h3>Metricas de Seguridad</h3>
        <div className="actions">
          <input
            type="date"
            value={metricsFilters.fromDate}
            onChange={(e) => setMetricsFilters({ ...metricsFilters, fromDate: e.target.value })}
          />
          <input
            type="date"
            value={metricsFilters.toDate}
            onChange={(e) => setMetricsFilters({ ...metricsFilters, toDate: e.target.value })}
          />
          <input
            type="number"
            min="0"
            max="23"
            placeholder="Hora desde"
            value={metricsFilters.hourFrom}
            onChange={(e) => setMetricsFilters({ ...metricsFilters, hourFrom: e.target.value })}
          />
          <input
            type="number"
            min="0"
            max="23"
            placeholder="Hora hasta"
            value={metricsFilters.hourTo}
            onChange={(e) => setMetricsFilters({ ...metricsFilters, hourTo: e.target.value })}
          />
          <button className="ghost" onClick={loadLoginMetrics}>
            Actualizar
          </button>
          <button
            className="ghost"
            onClick={() =>
              downloadFile(
                `/admin/login-audit/metrics/export/csv?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                'login_metrics.csv'
              )
            }
          >
            Exportar CSV
          </button>
          <select value={metricsTop} onChange={(e) => setMetricsTop(Number(e.target.value))}>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>
        </div>
      </div>
      <div className="table">
        {loginMetrics.map((m) => (
          <div key={m.day} className="row">
            <div>
              <strong>{m.day}</strong>
            </div>
            <div className="muted">
              Exitos: {m.success} · Fallos: {m.failed}
            </div>
          </div>
        ))}
        {!loginMetrics.length && <p className="muted">Sin datos.</p>}
      </div>
      {loginMetrics.length > 0 && (
        <div className="chart">
          {loginMetrics.map((m) => {
            const total = m.success + m.failed || 1
            const successPct = Math.round((m.success / total) * 100)
            const failedPct = 100 - successPct
            return (
              <div key={`chart-${m.day}`} className="chart-row">
                <span>{m.day}</span>
                <div className="bar">
                  <div
                    className="bar-success"
                    style={{ width: `${successPct}%` }}
                    title={`Exitos: ${m.success}`}
                  />
                  <div
                    className="bar-fail"
                    style={{ width: `${failedPct}%` }}
                    title={`Fallos: ${m.failed}`}
                  />
                </div>
                <span className="muted">
                  {m.success}/{m.failed}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {loginMetricsHourly.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Por hora</h4>
            <span className="muted">Exitos / Fallos</span>
            <div className="sort-controls">
              <label>Orden</label>
              <select
                value={hourlySort.key}
                onChange={(e) => setHourlySort((s) => ({ ...s, key: e.target.value }))}
              >
                <option value="hour">Hora</option>
                <option value="success">Exitos</option>
                <option value="failed">Fallos</option>
              </select>
              <button
                className="ghost"
                onClick={() =>
                  setHourlySort((s) => ({
                    ...s,
                    order: s.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                {hourlySort.order === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/admin/login-audit/metrics/hourly/export/csv?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                  'login_metrics_hourly.csv'
                )
              }
            >
              CSV
            </button>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/admin/login-audit/metrics/hourly/export/pdf?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                  'login_metrics_hourly.pdf'
                )
              }
            >
              PDF
            </button>
          </div>
          {[...loginMetricsHourly]
            .sort((a, b) => {
              const dir = hourlySort.order === 'asc' ? 1 : -1
              if (hourlySort.key === 'success') return (a.success - b.success) * dir
              if (hourlySort.key === 'failed') return (a.failed - b.failed) * dir
              return (new Date(a.hour) - new Date(b.hour)) * dir
            })
            .map((m) => (
              <div key={m.hour} className="row">
                <div>
                  <strong>{new Date(m.hour).toLocaleString()}</strong>
                </div>
                <div className="muted">
                  {m.success} / {m.failed}
                </div>
              </div>
            ))}
        </div>
      )}
      {loginMetricsByIp.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Por IP</h4>
            <span className="muted">Exitos / Fallos</span>
            <div className="sort-controls">
              <label>Orden</label>
              <select value={ipSort.key} onChange={(e) => setIpSort((s) => ({ ...s, key: e.target.value }))}>
                <option value="failed">Fallos</option>
                <option value="success">Exitos</option>
                <option value="ip">IP</option>
              </select>
              <button
                className="ghost"
                onClick={() =>
                  setIpSort((s) => ({
                    ...s,
                    order: s.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                {ipSort.order === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/admin/login-audit/metrics/ip/export/csv?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                  'login_metrics_ip.csv'
                )
              }
            >
              CSV
            </button>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/admin/login-audit/metrics/ip/export/pdf?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                  'login_metrics_ip.pdf'
                )
              }
            >
              PDF
            </button>
          </div>
          {[...loginMetricsByIp]
            .sort((a, b) => {
              const dir = ipSort.order === 'asc' ? 1 : -1
              if (ipSort.key === 'success') return (a.success - b.success) * dir
              if (ipSort.key === 'ip') return a.ip.localeCompare(b.ip) * dir
              return (a.failed - b.failed) * dir
            })
            .slice(0, metricsTop)
            .map((m) => (
              <div key={m.ip} className="row">
                <div>
                  <strong>{m.ip}</strong>
                </div>
                <div className="muted">
                  {m.success} / {m.failed}
                </div>
              </div>
            ))}
        </div>
      )}
      {loginMetricsByUser.length > 0 && (
        <div className="table">
          <div className="table-head">
            <h4>Por Usuario</h4>
            <span className="muted">Exitos / Fallos</span>
            <div className="sort-controls">
              <label>Orden</label>
              <select
                value={userSort.key}
                onChange={(e) => setUserSort((s) => ({ ...s, key: e.target.value }))}
              >
                <option value="failed">Fallos</option>
                <option value="success">Exitos</option>
                <option value="name">Usuario</option>
              </select>
              <button
                className="ghost"
                onClick={() =>
                  setUserSort((s) => ({
                    ...s,
                    order: s.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                {userSort.order === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/admin/login-audit/metrics/user/export/csv?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                  'login_metrics_user.csv'
                )
              }
            >
              CSV
            </button>
            <button
              className="ghost"
              onClick={() =>
                downloadFile(
                  `/admin/login-audit/metrics/user/export/pdf?fromDate=${metricsFilters.fromDate}&toDate=${metricsFilters.toDate}&hourFrom=${metricsFilters.hourFrom}&hourTo=${metricsFilters.hourTo}`,
                  'login_metrics_user.pdf'
                )
              }
            >
              PDF
            </button>
          </div>
          {[...loginMetricsByUser]
            .sort((a, b) => {
              const dir = userSort.order === 'asc' ? 1 : -1
              if (userSort.key === 'success') return (a.success - b.success) * dir
              if (userSort.key === 'name') {
                const an = a.user?.name || ''
                const bn = b.user?.name || ''
                return an.localeCompare(bn) * dir
              }
              return (a.failed - b.failed) * dir
            })
            .slice(0, metricsTop)
            .map((m) => (
              <div key={m.userId || `null-${m.failed}`} className="row">
                <div>
                  <strong>{m.user?.name || 'Desconocido'}</strong>
                  <span className="muted"> · {m.user?.email || 'N/A'}</span>
                </div>
                <div className="muted">
                  {m.success} / {m.failed}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default AuditSection
