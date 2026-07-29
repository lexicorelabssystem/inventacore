import { useState } from 'react'

function formatDateInput(dateValue) {
  const date = new Date(dateValue)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function useAuditAdmin({ api, setErr, setOk, openConfirm, closeConfirm }) {
  const [adminAudits, setAdminAudits] = useState([])
  const [adminAuditLoading, setAdminAuditLoading] = useState(false)
  const [adminAuditPage, setAdminAuditPage] = useState(1)
  const [adminAuditTotal, setAdminAuditTotal] = useState(0)
  const [loginAudits, setLoginAudits] = useState([])
  const [loginAuditLoading, setLoginAuditLoading] = useState(false)
  const [loginAuditPage, setLoginAuditPage] = useState(1)
  const [loginAuditTotal, setLoginAuditTotal] = useState(0)
  const [loginMetrics, setLoginMetrics] = useState([])
  const [loginMetricsHourly, setLoginMetricsHourly] = useState([])
  const [loginMetricsByIp, setLoginMetricsByIp] = useState([])
  const [loginMetricsByUser, setLoginMetricsByUser] = useState([])
  const [metricsTop, setMetricsTop] = useState(10)
  const [hourlySort, setHourlySort] = useState({ key: 'hour', order: 'asc' })
  const [ipSort, setIpSort] = useState({ key: 'failed', order: 'desc' })
  const [userSort, setUserSort] = useState({ key: 'failed', order: 'desc' })
  const [metricsFilters, setMetricsFilters] = useState({
    fromDate: '',
    toDate: '',
    hourFrom: '',
    hourTo: '',
  })
  const [auditFilters, setAuditFilters] = useState({
    entityType: '',
    action: '',
    fromDate: '',
    toDate: '',
  })
  const [loginAuditFilters, setLoginAuditFilters] = useState({
    email: '',
    success: '',
    fromDate: '',
    toDate: '',
  })
  const [auditCleanupForm, setAuditCleanupForm] = useState({
    scope: 'ALL',
    mode: 'KEEP_DAYS',
    beforeDate: '',
    keepDays: 90,
  })

  function applyAuditRangePreset(target, preset) {
    const now = new Date()
    const toDate = formatDateInput(now)
    const from = new Date(now)
    if (preset === 'WEEK') from.setDate(now.getDate() - 6)
    if (preset === 'MONTH') from.setDate(now.getDate() - 29)
    if (preset === 'YEAR') from.setDate(now.getDate() - 364)
    const fromDate = formatDateInput(from)

    if (target === 'admin') {
      setAuditFilters((prev) => ({ ...prev, fromDate, toDate }))
      return
    }
    setLoginAuditFilters((prev) => ({ ...prev, fromDate, toDate }))
  }

  function buildAdminAuditParams(filters = auditFilters) {
    const params = new URLSearchParams()
    if (filters.entityType) params.set('entityType', filters.entityType)
    if (filters.action) params.set('action', filters.action)
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    return params
  }

  function buildLoginAuditParams(filters = loginAuditFilters) {
    const params = new URLSearchParams()
    if (filters.email) params.set('email', filters.email)
    if (filters.success !== '') params.set('success', filters.success)
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)
    return params
  }

  function resetAdminAuditFilters() {
    const defaults = {
      entityType: '',
      action: '',
      fromDate: '',
      toDate: '',
    }
    setAuditFilters(defaults)
    setAdminAuditPage(1)
    loadAdminAudits(1, defaults)
  }

  function resetLoginAuditFilters() {
    const defaults = {
      email: '',
      success: '',
      fromDate: '',
      toDate: '',
    }
    setLoginAuditFilters(defaults)
    setLoginAuditPage(1)
    loadLoginAudits(1, defaults)
  }

  async function loadAdminAudits(page = adminAuditPage, filters = auditFilters) {
    setAdminAuditLoading(true)
    try {
      const take = 20
      const safePage = Number(page)
      const nextPage = Number.isFinite(safePage) && safePage > 0 ? safePage : 1
      const skip = (nextPage - 1) * take
      const params = buildAdminAuditParams(filters)
      params.set('take', String(take))
      params.set('skip', String(skip))
      const data = await api(`/admin/audit?${params.toString()}`)
      setAdminAudits(data.items || [])
      setAdminAuditTotal(data.total || 0)
      setAdminAuditPage(nextPage)
    } catch (err) {
      setErr(err)
      setAdminAudits([])
      setAdminAuditTotal(0)
    } finally {
      setAdminAuditLoading(false)
    }
  }

  async function loadLoginAudits(page = loginAuditPage, filters = loginAuditFilters) {
    setLoginAuditLoading(true)
    try {
      const take = 20
      const safePage = Number(page)
      const nextPage = Number.isFinite(safePage) && safePage > 0 ? safePage : 1
      const skip = (nextPage - 1) * take
      const params = buildLoginAuditParams(filters)
      params.set('take', String(take))
      params.set('skip', String(skip))
      const data = await api(`/admin/login-audit?${params.toString()}`)
      setLoginAudits(data.items || [])
      setLoginAuditTotal(data.total || 0)
      setLoginAuditPage(nextPage)
    } catch (err) {
      setErr(err)
      setLoginAudits([])
      setLoginAuditTotal(0)
    } finally {
      setLoginAuditLoading(false)
    }
  }

  async function loadLoginMetrics() {
    const params = new URLSearchParams()
    if (metricsFilters.fromDate) params.set('fromDate', metricsFilters.fromDate)
    if (metricsFilters.toDate) params.set('toDate', metricsFilters.toDate)
    if (metricsFilters.hourFrom !== '') params.set('hourFrom', metricsFilters.hourFrom)
    if (metricsFilters.hourTo !== '') params.set('hourTo', metricsFilters.hourTo)
    const qs = params.toString()
    const base = qs ? `?${qs}` : ''
    const data = await api(`/admin/login-audit/metrics${base}`)
    const hourly = await api(`/admin/login-audit/metrics/hourly${base}`)
    const byIp = await api(`/admin/login-audit/metrics/ip${base}`)
    const byUser = await api(`/admin/login-audit/metrics/user${base}`)
    setLoginMetrics(data.items || [])
    setLoginMetricsHourly(hourly.items || [])
    setLoginMetricsByIp(byIp.items || [])
    setLoginMetricsByUser(byUser.items || [])
  }

  async function runAuditCleanup() {
    const modeDescription =
      auditCleanupForm.mode === 'DELETE_ALL'
        ? 'Se borrara todo el historial del alcance seleccionado.'
        : auditCleanupForm.mode === 'BEFORE_DATE'
          ? `Se borraran registros anteriores a ${auditCleanupForm.beforeDate || '(sin fecha)'}.`
          : `Se conservaran solo los ultimos ${auditCleanupForm.keepDays} dias.`

    openConfirm({
      title: 'Confirmar limpieza de auditoria',
      message: modeDescription,
      onConfirm: async () => {
        const body = {
          scope: auditCleanupForm.scope,
          mode: auditCleanupForm.mode,
        }
        if (auditCleanupForm.mode === 'BEFORE_DATE') body.beforeDate = auditCleanupForm.beforeDate
        if (auditCleanupForm.mode === 'KEEP_DAYS') {
          body.keepDays = Number(auditCleanupForm.keepDays)
        }

        try {
          const result = await api('/admin/audit/cleanup', {
            method: 'POST',
            body,
          })
          setOk(
            `Limpieza auditoria completada. Admin: ${result.deleted?.adminAudit || 0}, Login: ${
              result.deleted?.loginAudit || 0
            }`
          )
          await Promise.all([loadAdminAudits(), loadLoginAudits(), loadLoginMetrics()])
        } catch (err) {
          setErr(err)
        } finally {
          closeConfirm()
        }
      },
    })
  }

  return {
    adminAudits,
    adminAuditLoading,
    adminAuditPage,
    adminAuditTotal,
    loginAudits,
    loginAuditLoading,
    loginAuditPage,
    loginAuditTotal,
    loginMetrics,
    loginMetricsHourly,
    loginMetricsByIp,
    loginMetricsByUser,
    metricsTop,
    setMetricsTop,
    hourlySort,
    setHourlySort,
    ipSort,
    setIpSort,
    userSort,
    setUserSort,
    metricsFilters,
    setMetricsFilters,
    auditFilters,
    setAuditFilters,
    loginAuditFilters,
    setLoginAuditFilters,
    auditCleanupForm,
    setAuditCleanupForm,
    applyAuditRangePreset,
    buildAdminAuditParams,
    buildLoginAuditParams,
    resetAdminAuditFilters,
    resetLoginAuditFilters,
    loadAdminAudits,
    loadLoginAudits,
    loadLoginMetrics,
    runAuditCleanup,
  }
}

export default useAuditAdmin
