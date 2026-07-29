import { useEffect, useEffectEvent, useState } from 'react'

function useAssistantCentral({
  api,
  setErr,
  setOk,
  loadEstablishmentCatalog,
  loadDependencyCatalog,
  setDependenciesCatalog,
  isAuthed,
  isCentral,
  activeTab,
  toPositiveIntOrNull,
}) {
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantNotifyEmail, setAssistantNotifyEmail] = useState(
    'admin-central@inventacore.cl'
  )
  const [assistantScope, setAssistantScope] = useState({
    institutionId: '',
    establishmentId: '',
    dependencyId: '',
  })
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantSmtpLoading, setAssistantSmtpLoading] = useState(false)
  const [assistantAnswer, setAssistantAnswer] = useState(null)
  const [supportRequests, setSupportRequests] = useState([])
  const [supportLoading, setSupportLoading] = useState(false)
  const [supportPage, setSupportPage] = useState(1)
  const [supportTotal, setSupportTotal] = useState(0)
  const [supportFilters, setSupportFilters] = useState({
    q: '',
    status: '',
    priority: '',
  })
  const [supportCommentDraft, setSupportCommentDraft] = useState({})

  async function askCentralAssistant() {
    try {
      const question = String(assistantQuestion || '').trim()
      if (question.length < 5) {
        setErr('Escribe una consulta mas detallada (minimo 5 caracteres).')
        return
      }
      setAssistantLoading(true)
      const body = { question }
      const institutionId = toPositiveIntOrNull(assistantScope.institutionId)
      const establishmentId = toPositiveIntOrNull(assistantScope.establishmentId)
      const dependencyId = toPositiveIntOrNull(assistantScope.dependencyId)
      if (institutionId) body.institutionId = institutionId
      if (establishmentId) body.establishmentId = establishmentId
      if (dependencyId) body.dependencyId = dependencyId
      const result = await api('/admin/assistant/ask', { method: 'POST', body })
      setAssistantAnswer(result)
      setOk('Asistente central respondio correctamente.')
    } catch (err) {
      setErr(err)
    } finally {
      setAssistantLoading(false)
    }
  }

  async function createSupportRequestFromAssistant() {
    if (!assistantAnswer?.question) {
      setErr('Primero consulta al asistente para generar una solicitud.')
      return
    }
    try {
      const body = {
        subject: assistantAnswer.suggestedSubject || `Solicitud central ${Date.now()}`,
        question: assistantAnswer.question,
        responseDraft: assistantAnswer.answer || '',
        priority: assistantAnswer.suggestedPriority || 'MEDIUM',
        dueHours: 72,
        source: 'ASSISTANT_UI',
      }
      const notifyEmail = String(assistantNotifyEmail || '').trim()
      if (notifyEmail) body.contactEmail = notifyEmail
      const scope = assistantAnswer.scope || {}
      if (scope.institutionId) body.institutionId = Number(scope.institutionId)
      if (scope.establishmentId) body.establishmentId = Number(scope.establishmentId)
      if (scope.dependencyId) body.dependencyId = Number(scope.dependencyId)
      const created = await api('/admin/support-requests', { method: 'POST', body })
      setOk(`Solicitud creada #${created.id}. SLA objetivo: 72 horas.`)
      setSupportPage(1)
      await loadSupportRequests(1)
    } catch (err) {
      setErr(err)
    }
  }

  async function testAssistantSmtp() {
    try {
      setAssistantSmtpLoading(true)
      const email = String(assistantNotifyEmail || '').trim()
      const body = email ? { email } : {}
      const result = await api('/admin/support-requests/test-email', {
        method: 'POST',
        body,
      })
      const status = result?.delivery?.status || 'unknown'
      if (status === 'sent') {
        setOk(`SMTP OK. Correo de prueba enviado a ${result.email}.`)
      } else {
        const reason = result?.delivery?.reason || 'SMTP_TEST_FAILED'
        setErr({
          message: `No se pudo enviar correo SMTP de prueba (${reason}).`,
          code: reason,
          details: result?.delivery || null,
        })
      }
    } catch (err) {
      setErr(err)
    } finally {
      setAssistantSmtpLoading(false)
    }
  }

  async function loadSupportRequests(page = supportPage) {
    try {
      setSupportLoading(true)
      const take = 10
      const skip = (page - 1) * take
      const params = new URLSearchParams()
      if (supportFilters.q) params.set('q', supportFilters.q)
      if (supportFilters.status) params.set('status', supportFilters.status)
      if (supportFilters.priority) params.set('priority', supportFilters.priority)
      params.set('take', String(take))
      params.set('skip', String(skip))
      const data = await api(`/admin/support-requests?${params.toString()}`)
      setSupportRequests(data.items || [])
      setSupportTotal(data.total || 0)
      setSupportPage(page)
    } catch (err) {
      setErr(err)
    } finally {
      setSupportLoading(false)
    }
  }

  async function updateSupportStatus(item, status) {
    try {
      await api(`/admin/support-requests/${item.id}/status`, {
        method: 'PUT',
        body: { status },
      })
      await loadSupportRequests(supportPage)
      setOk(`Solicitud #${item.id} actualizada a ${status}.`)
    } catch (err) {
      setErr(err)
    }
  }

  async function sendSupportComment(item) {
    try {
      const text = String(supportCommentDraft[item.id] || '').trim()
      if (!text) {
        setErr('Escribe un comentario antes de enviar.')
        return
      }
      await api(`/admin/support-requests/${item.id}/comments`, {
        method: 'POST',
        body: { message: text },
      })
      setSupportCommentDraft((prev) => ({ ...prev, [item.id]: '' }))
      await loadSupportRequests(supportPage)
      setOk(`Comentario agregado en solicitud #${item.id}.`)
    } catch (err) {
      setErr(err)
    }
  }

  const handleInstitutionScopeChange = useEffectEvent(() => {
    if (!isAuthed || activeTab !== 'assistant' || !isCentral) return
    void loadEstablishmentCatalog(assistantScope.institutionId).catch((err) => {
      setErr(err)
    })
  })

  const handleEstablishmentScopeChange = useEffectEvent(() => {
    if (!isAuthed || activeTab !== 'assistant' || !isCentral) return
    if (!assistantScope.establishmentId) {
      setDependenciesCatalog((prev) => (prev.length ? [] : prev))
      return
    }
    void loadDependencyCatalog(assistantScope.establishmentId).catch((err) => {
      setErr(err)
    })
  })

  useEffect(() => {
    handleInstitutionScopeChange()
  }, [activeTab, assistantScope.institutionId, isAuthed, isCentral])

  useEffect(() => {
    handleEstablishmentScopeChange()
  }, [
    activeTab,
    assistantScope.establishmentId,
    isAuthed,
    isCentral,
  ])

  return {
    assistantQuestion,
    setAssistantQuestion,
    assistantNotifyEmail,
    setAssistantNotifyEmail,
    assistantScope,
    setAssistantScope,
    assistantLoading,
    assistantSmtpLoading,
    assistantAnswer,
    supportRequests,
    supportLoading,
    supportPage,
    setSupportPage,
    supportTotal,
    supportFilters,
    setSupportFilters,
    supportCommentDraft,
    setSupportCommentDraft,
    askCentralAssistant,
    createSupportRequestFromAssistant,
    testAssistantSmtp,
    loadSupportRequests,
    updateSupportStatus,
    sendSupportComment,
  }
}

export default useAssistantCentral
