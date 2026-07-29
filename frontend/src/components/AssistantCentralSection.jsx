import { AssistantTabPanel } from './tabPanels'
import { UI_TEXT } from '../constants/uiText'

function AssistantCentralSection({
  loadSupportRequests,
  testAssistantSmtp,
  assistantSmtpLoading,
  assistantQuestion,
  setAssistantQuestion,
  assistantScope,
  setAssistantScope,
  institutionsCatalog,
  establishmentsCatalog,
  dependenciesCatalog,
  assistantNotifyEmail,
  setAssistantNotifyEmail,
  askCentralAssistant,
  assistantLoading,
  assistantAnswer,
  createSupportRequestFromAssistant,
  supportFilters,
  setSupportFilters,
  supportRequests,
  supportTotal,
  supportLoading,
  supportPage,
  setSupportPage,
  updateSupportStatus,
  supportCommentDraft,
  setSupportCommentDraft,
  sendSupportComment,
}) {
  return (
    <AssistantTabPanel>
      <div className="section module-section module-section-assistant">
        <div className="section-head">
          <h3>Asistente Central y Mesa de Solicitudes</h3>
          <div className="actions">
            <button onClick={() => loadSupportRequests(1)}>{UI_TEXT.updating}</button>
            <button className="ghost" onClick={testAssistantSmtp} disabled={assistantSmtpLoading}>
              {assistantSmtpLoading ? 'Probando SMTP...' : 'Probar SMTP'}
            </button>
          </div>
        </div>
        <div className="split">
          <div className="form-card">
            <h4>Consulta al asistente</h4>
            <textarea
              rows={4}
              placeholder="Escribe la consulta del inventario..."
              value={assistantQuestion}
              onChange={(e) => setAssistantQuestion(e.target.value)}
            />
            <div className="grid">
              <select
                value={assistantScope.institutionId}
                onChange={(e) =>
                  setAssistantScope((prev) => ({
                    ...prev,
                    institutionId: e.target.value,
                    establishmentId: '',
                    dependencyId: '',
                  }))
                }
              >
                <option value="">{`${UI_TEXT.institution} (opcional)`}</option>
                {institutionsCatalog.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={assistantScope.establishmentId}
                onChange={(e) =>
                  setAssistantScope((prev) => ({
                    ...prev,
                    establishmentId: e.target.value,
                    dependencyId: '',
                  }))
                }
                disabled={!assistantScope.institutionId}
              >
                <option value="">Establecimiento (opcional)</option>
                {establishmentsCatalog
                  .filter((item) =>
                    assistantScope.institutionId
                      ? String(item.institutionId) === String(assistantScope.institutionId)
                      : true
                  )
                  .map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <select
                value={assistantScope.dependencyId}
                onChange={(e) =>
                  setAssistantScope((prev) => ({
                    ...prev,
                    dependencyId: e.target.value,
                  }))
                }
                disabled={!assistantScope.establishmentId}
              >
                <option value="">Sector (opcional)</option>
                {dependenciesCatalog.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                type="email"
                placeholder="Correo destino notificaciones"
                value={assistantNotifyEmail}
                onChange={(e) => setAssistantNotifyEmail(e.target.value)}
              />
            </div>
            <button className="primary" onClick={askCentralAssistant} disabled={assistantLoading}>
              {assistantLoading ? 'Analizando...' : 'Preguntar'}
            </button>
          </div>

          <div className="form-card">
            <h4>Respuesta</h4>
            {!assistantAnswer ? (
              <p className="muted">Sin respuesta aun.</p>
            ) : (
              <>
                <p>{assistantAnswer.answer}</p>
                <p className="muted">
                  Contexto: activos {assistantAnswer.context?.assetsActive || 0} - abiertas{' '}
                  {assistantAnswer.context?.openRequests || 0} - vencidas{' '}
                  {assistantAnswer.context?.overdueRequests || 0}
                </p>
                <ul>
                  {(assistantAnswer.suggestions || []).map((suggestion, idx) => (
                    <li key={`assistant-suggestion-${idx}`}>{suggestion}</li>
                  ))}
                </ul>
                <button className="ghost" onClick={createSupportRequestFromAssistant}>
                  Crear solicitud (SLA 72h)
                </button>
              </>
            )}
          </div>
        </div>

        <div className="section-head">
          <h4>Mesa de solicitudes</h4>
          <div className="actions">
            <input
              placeholder="Buscar asunto/pregunta..."
              value={supportFilters.q}
              onChange={(e) => setSupportFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
            <select
              value={supportFilters.status}
              onChange={(e) =>
                setSupportFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option value="">Todos estados</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
            <select
              value={supportFilters.priority}
              onChange={(e) =>
                setSupportFilters((prev) => ({ ...prev, priority: e.target.value }))
              }
            >
              <option value="">Todas prioridades</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
            <button onClick={() => loadSupportRequests(1)}>Buscar</button>
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <span className="muted">
              Mostrando {supportRequests.length} de {supportTotal}
            </span>
          </div>
          {supportLoading && <p className="muted">Cargando solicitudes...</p>}
          {!supportLoading &&
            supportRequests.map((item, idx) => (
              <div key={item.id} className="row">
                <div className="row-main">
                  <strong>#{(supportPage - 1) * 10 + idx + 1}</strong>
                  <span className="pill">ID real: {item.id}</span>
                  <span className="pill">{item.status}</span>
                  <span className="pill">{item.priority}</span>
                  <span>{item.subject}</span>
                  <span className="muted">
                    Vence: {item.dueAt ? new Date(item.dueAt).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="row-actions">
                  <button className="ghost" onClick={() => updateSupportStatus(item, 'IN_PROGRESS')}>
                    Tomar
                  </button>
                  <button className="ghost" onClick={() => updateSupportStatus(item, 'RESOLVED')}>
                    Resolver
                  </button>
                  <button className="ghost" onClick={() => updateSupportStatus(item, 'OPEN')}>
                    Reabrir
                  </button>
                </div>
                <div className="row-main" style={{ marginTop: 8 }}>
                  <span className="muted">{item.question}</span>
                </div>
                <div className="row-main" style={{ marginTop: 8 }}>
                  <input
                    className="inline-input"
                    placeholder="Agregar comentario..."
                    value={supportCommentDraft[item.id] || ''}
                    onChange={(e) =>
                      setSupportCommentDraft((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                  <button className="ghost" onClick={() => sendSupportComment(item)}>
                    Comentar
                  </button>
                </div>
              </div>
            ))}
          {!supportLoading && !supportRequests.length && (
            <p className="muted">Sin solicitudes.</p>
          )}
        </div>

        <div className="pager">
          <button
            className="ghost"
            disabled={supportPage <= 1}
            onClick={() => {
              const next = supportPage - 1
              setSupportPage(next)
              loadSupportRequests(next)
            }}
          >
            {UI_TEXT.previous}
          </button>
          <span>
            {UI_TEXT.page} {supportPage} / {Math.max(1, Math.ceil(supportTotal / 10))}
          </span>
          <button
            className="ghost"
            disabled={supportPage >= Math.ceil(supportTotal / 10)}
            onClick={() => {
              const next = supportPage + 1
              setSupportPage(next)
              loadSupportRequests(next)
            }}
          >
            {UI_TEXT.next}
          </button>
        </div>
      </div>
    </AssistantTabPanel>
  )
}

export default AssistantCentralSection
