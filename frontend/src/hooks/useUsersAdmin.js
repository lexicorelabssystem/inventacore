import { useEffect, useRef, useState } from 'react'
import { UI_STATUS, UI_SUCCESS } from '../constants/uiMessages'

function uniqueById(items) {
  return Array.from(new Map((items || []).map((item) => [item.id, item])).values())
}

function useUsersAdmin({
  api,
  apiMultipart,
  setErr,
  setOk,
  openConfirm,
  closeConfirm,
  currentUser,
  setCurrentUser,
  isAuthed,
  isCentral,
  activeTab,
  toPositiveIntOrNull,
}) {
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userInstitutionOptions, setUserInstitutionOptions] = useState([])
  const [userEstablishmentOptions, setUserEstablishmentOptions] = useState([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersOriginal, setUsersOriginal] = useState({})
  const [userFilters, setUserFilters] = useState({
    q: '',
    roleType: '',
    institutionId: '',
    establishmentId: '',
    includeInactive: false,
  })
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    roleType: 'ADMIN_ESTABLISHMENT',
    institutionId: '',
    establishmentId: '',
  })
  const [userFormPhotoFile, setUserFormPhotoFile] = useState(null)
  const [userFormWithoutPhoto, setUserFormWithoutPhoto] = useState(false)
  const [userPhotoFiles, setUserPhotoFiles] = useState({})
  const usersSearchDebounceRef = useRef(null)
  const userAssignmentsPromiseRef = useRef(null)
  const userAssignmentsLoadedRef = useRef(false)

  async function loadUsersAdmin(page = usersPage) {
    setUsersLoading(true)
    try {
      const take = 10
      const skip = (page - 1) * take
      const params = new URLSearchParams()
      if (userFilters.q) params.set('q', userFilters.q)
      if (userFilters.roleType) params.set('roleType', userFilters.roleType)
      if (userFilters.institutionId) params.set('institutionId', userFilters.institutionId)
      if (userFilters.establishmentId) {
        params.set('establishmentId', userFilters.establishmentId)
      }
      if (userFilters.includeInactive) params.set('includeInactive', 'true')
      params.set('take', String(take))
      params.set('skip', String(skip))

      const data = await api(`/admin/users?${params.toString()}`)
      const mapped = (data.items || []).map((user) => ({
        ...user,
        roleType: user.role?.type || '',
      }))
      setUsers(mapped)
      setUsersTotal(data.total || 0)
      setUsersPage(page)

      const snapshot = {}
      mapped.forEach((user) => {
        snapshot[user.id] = {
          name: user.name || '',
          roleType: user.roleType || '',
          institutionId: user.institutionId || '',
          establishmentId: user.establishmentId || '',
        }
      })
      setUsersOriginal(snapshot)
    } catch (err) {
      setErr(err)
    } finally {
      setUsersLoading(false)
    }
  }

  function applyUpdatedUserInList(updatedUser) {
    if (!updatedUser?.id) return
    setUsers((prev) =>
      prev.map((item) =>
        Number(item.id) === Number(updatedUser.id)
          ? {
              ...item,
              ...updatedUser,
              roleType: updatedUser.role?.type || updatedUser.roleType || item.roleType,
            }
          : item
      )
    )
  }

  function syncCurrentUserPhotoIfNeeded(updatedUser) {
    if (!updatedUser?.id) return
    if (Number(currentUser?.id) !== Number(updatedUser.id)) return
    const next = {
      ...currentUser,
      hasPhoto: Boolean(updatedUser.hasPhoto),
      photoDataUrl: updatedUser.photoDataUrl || null,
    }
    setCurrentUser(next)
    localStorage.setItem('admin_user', JSON.stringify(next))
  }

  async function saveUserPhotoAdmin(userId, file) {
    if (!file) {
      setErr('Selecciona una foto JPG/PNG antes de guardar.')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    const updated = await apiMultipart(`/admin/users/${userId}/photo`, {
      method: 'PUT',
      formData,
    })
    applyUpdatedUserInList(updated)
    syncCurrentUserPhotoIfNeeded(updated)
    setUserPhotoFiles((prev) => ({ ...prev, [userId]: null }))
    setOk(UI_STATUS.photoUpdated)
  }

  async function clearUserPhotoAdmin(userId) {
    const updated = await api(`/admin/users/${userId}/photo`, { method: 'DELETE' })
    applyUpdatedUserInList(updated)
    syncCurrentUserPhotoIfNeeded(updated)
    setUserPhotoFiles((prev) => ({ ...prev, [userId]: null }))
    setOk('Usuario marcado sin foto.')
  }

  async function loadUserAssignmentOptions(options = {}) {
    const { force = false } = options
    if (!force && userAssignmentsLoadedRef.current) {
      return {
        institutions: userInstitutionOptions,
        establishments: userEstablishmentOptions,
      }
    }
    if (!force && userAssignmentsPromiseRef.current) return userAssignmentsPromiseRef.current

    userAssignmentsPromiseRef.current = (async () => {
      try {
        const institutionsRes = await api('/catalog/institutions?take=100')
        const nextInstitutions = institutionsRes.items || []
        setUserInstitutionOptions(nextInstitutions)

        const take = 100
        let skip = 0
        let total = 0
        const allEstablishments = []
        do {
          const params = new URLSearchParams()
          params.set('take', String(take))
          params.set('skip', String(skip))
          const page = await api(`/catalog/establishments?${params.toString()}`)
          const items = page.items || []
          total = Number(page.total || 0)
          allEstablishments.push(...items)
          skip += take
          if (!items.length) break
        } while (skip < total && allEstablishments.length < 10000)

        const nextEstablishments = uniqueById(allEstablishments)
        setUserEstablishmentOptions(nextEstablishments)
        userAssignmentsLoadedRef.current = true
        return {
          institutions: nextInstitutions,
          establishments: nextEstablishments,
        }
      } catch (err) {
        setErr(err)
        throw err
      } finally {
        userAssignmentsPromiseRef.current = null
      }
    })()

    return userAssignmentsPromiseRef.current
  }

  async function createUserAdmin() {
    try {
      if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) {
        setErr('Nombre, email y password son requeridos.')
        return
      }
      const institutionId = toPositiveIntOrNull(userForm.institutionId)
      const establishmentId = toPositiveIntOrNull(userForm.establishmentId)
      if (userForm.roleType === 'ADMIN_CENTRAL') {
        if (userForm.institutionId && !institutionId) {
          setErr('Institution ID invalido. Debe ser un numero mayor a 0.')
          return
        }
      } else if (!establishmentId) {
        setErr('Establishment ID requerido para este rol (numero mayor a 0).')
        return
      }
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password,
        roleType: userForm.roleType,
      }
      if (userForm.roleType === 'ADMIN_CENTRAL') {
        if (institutionId) payload.institutionId = institutionId
      } else if (establishmentId) {
        payload.establishmentId = establishmentId
      }

      const created = await api('/admin/users', { method: 'POST', body: payload })
      if (userFormPhotoFile && !userFormWithoutPhoto) {
        await saveUserPhotoAdmin(created.id, userFormPhotoFile)
      }
      setUserForm({
        name: '',
        email: '',
        password: '',
        roleType: 'ADMIN_ESTABLISHMENT',
        institutionId: '',
        establishmentId: '',
      })
      setUserFormPhotoFile(null)
      setUserFormWithoutPhoto(false)
      await loadUsersAdmin(1)
      setOk(UI_SUCCESS.userCreated(created.email))
    } catch (err) {
      setErr(err)
    }
  }

  async function updateUserAdmin(user) {
    try {
      const institutionId = toPositiveIntOrNull(user.institutionId)
      const establishmentId = toPositiveIntOrNull(user.establishmentId)
      const payload = {
        name: user.name,
        roleType: user.roleType,
      }
      if (user.roleType === 'ADMIN_CENTRAL') {
        if (user.institutionId && !institutionId) {
          setErr('Institution ID invalido. Debe ser un numero mayor a 0.')
          return
        }
        if (institutionId) payload.institutionId = institutionId
      } else {
        if (!establishmentId) {
          setErr('Establishment ID requerido para este rol (numero mayor a 0).')
          return
        }
        payload.establishmentId = establishmentId
      }
      const updated = await api(`/admin/users/${user.id}`, {
        method: 'PUT',
        body: payload,
      })
      setOk(UI_SUCCESS.userUpdated(updated.email))
      await loadUsersAdmin(usersPage)
    } catch (err) {
      setErr(err)
    }
  }

  async function deactivateUserAdmin(userId, email) {
    openConfirm({
      title: 'Desactivar usuario',
      message: `Se desactivara ${email}. Podra quedar visible con "inactivos".`,
      onConfirm: async () => {
        try {
          await api(`/admin/users/${userId}`, { method: 'DELETE' })
          await loadUsersAdmin(usersPage)
          setOk(UI_SUCCESS.userDeactivated(email))
        } catch (err) {
          setErr(err)
        } finally {
          closeConfirm()
        }
      },
    })
  }

  async function reactivateUserAdmin(userId, email) {
    try {
      await api(`/admin/users/${userId}/reactivate`, { method: 'PUT' })
      await loadUsersAdmin(usersPage)
      setOk(UI_SUCCESS.userReactivated(email))
    } catch (err) {
      setErr(err)
    }
  }

  async function resetUserPasswordAdmin(user) {
    try {
      const suggestedPassword = 'Temporal2026!'
      const rawPassword = window.prompt(
        `Nueva clave temporal para ${user.email}`,
        suggestedPassword
      )
      if (rawPassword === null) return
      const password = String(rawPassword).trim()
      if (password.length < 8) {
        setErr('La clave temporal debe tener al menos 8 caracteres.')
        return
      }
      const result = await api(`/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        body: { password },
      })
      setOk(`Clave restablecida para ${result.email}. Temporal: ${password}`)
    } catch (err) {
      setErr(err)
    }
  }

  useEffect(() => {
    if (!isAuthed || !isCentral) return
    if (activeTab !== 'users') return

    if (usersSearchDebounceRef.current) {
      clearTimeout(usersSearchDebounceRef.current)
    }
    usersSearchDebounceRef.current = setTimeout(() => {
      loadUsersAdmin(1)
    }, 320)

    return () => {
      if (usersSearchDebounceRef.current) {
        clearTimeout(usersSearchDebounceRef.current)
        usersSearchDebounceRef.current = null
      }
    }
  }, [
    activeTab,
    isAuthed,
    isCentral,
    userFilters.establishmentId,
    userFilters.includeInactive,
    userFilters.institutionId,
    userFilters.q,
    userFilters.roleType,
  ])

  return {
    users,
    setUsers,
    usersLoading,
    userInstitutionOptions,
    userEstablishmentOptions,
    usersPage,
    setUsersPage,
    usersTotal,
    usersOriginal,
    userFilters,
    setUserFilters,
    userForm,
    setUserForm,
    userFormPhotoFile,
    setUserFormPhotoFile,
    userFormWithoutPhoto,
    setUserFormWithoutPhoto,
    userPhotoFiles,
    setUserPhotoFiles,
    loadUsersAdmin,
    loadUserAssignmentOptions,
    createUserAdmin,
    saveUserPhotoAdmin,
    clearUserPhotoAdmin,
    updateUserAdmin,
    deactivateUserAdmin,
    reactivateUserAdmin,
    resetUserPasswordAdmin,
  }
}

export default useUsersAdmin
