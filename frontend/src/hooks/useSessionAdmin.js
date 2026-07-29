import { useCallback, useEffect, useRef, useState } from 'react'
import { UI_STATUS } from '../constants/uiMessages'

function useSessionAdmin({
  api,
  setToken,
  setCurrentUser,
  setOk,
  setErr,
  getLoginErrorMessage,
  introVideoRef,
  userMenuRef,
  dangerZoneUnlockPassword,
}) {
  const [login, setLogin] = useState({
    email: '',
    password: '',
  })
  const [showIntro, setShowIntro] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [loginErrorModal, setLoginErrorModal] = useState({
    open: false,
    title: 'No se pudo iniciar sesion',
    message: '',
  })
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [dangerZoneUnlocked, setDangerZoneUnlocked] = useState(false)
  const [dangerZoneUnlocking, setDangerZoneUnlocking] = useState(false)
  const [dangerZoneUnlockModalOpen, setDangerZoneUnlockModalOpen] = useState(false)
  const [dangerZoneUnlockInput, setDangerZoneUnlockInput] = useState('')
  const [dangerZoneUnlockError, setDangerZoneUnlockError] = useState('')
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const dangerZoneLockTimerRef = useRef(null)
  const DANGER_ZONE_UNLOCK_TTL_MS = 10 * 60 * 1000

  const closeIntro = useCallback(() => {
    setShowIntro(false)
  }, [])

  useEffect(() => {
    if (!showIntro) return
    const video = introVideoRef.current
    if (!video) return

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        window.setTimeout(() => {
          closeIntro()
        }, 1800)
      })
    }
  }, [closeIntro, introVideoRef, showIntro])

  useEffect(() => {
    if (!isUserMenuOpen) return

    function handlePointerDown(event) {
      if (userMenuRef.current?.contains(event.target)) return
      if (isChangePasswordOpen) closeChangePassword()
      setIsUserMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isChangePasswordOpen, isUserMenuOpen, userMenuRef])

  useEffect(
    () => () => {
      if (dangerZoneLockTimerRef.current) {
        clearTimeout(dangerZoneLockTimerRef.current)
        dangerZoneLockTimerRef.current = null
      }
    },
    []
  )

  async function handleLogin(e) {
    e.preventDefault()
    const sanitizedLogin = {
      email: String(login.email || '').trim(),
      password: String(login.password || ''),
    }
    if (!sanitizedLogin.email || !sanitizedLogin.password.trim()) {
      const message = getLoginErrorMessage({ code: 'VALIDATION_ERROR' })
      setErr(message)
      setLoginErrorModal({
        open: true,
        title: 'Datos invalidos',
        message,
      })
      return
    }
    setIsLoginLoading(true)
    const startedAt = Date.now()
    const waitAtLeastOneSecond = async () => {
      const elapsed = Date.now() - startedAt
      const remaining = 1000 - elapsed
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }
    }
    try {
      const result = await api('/auth/login', { method: 'POST', body: sanitizedLogin })
      await waitAtLeastOneSecond()
      localStorage.setItem('admin_token', result.token)
      setToken(result.token)
      if (result.user) {
        localStorage.setItem('admin_user', JSON.stringify(result.user))
        setCurrentUser(result.user)
      }
      setShowIntro(true)
      setLoginErrorModal((prev) => ({ ...prev, open: false, message: '' }))
      setOk(UI_STATUS.sessionStarted)
    } catch (err) {
      await waitAtLeastOneSecond()
      const message = getLoginErrorMessage(err)
      setErr({
        ...err,
        message,
        requestId: null,
        details: null,
      })
      setLoginErrorModal({
        open: true,
        title: 'Acceso denegado',
        message,
      })
    } finally {
      setIsLoginLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      if (dangerZoneLockTimerRef.current) {
        clearTimeout(dangerZoneLockTimerRef.current)
        dangerZoneLockTimerRef.current = null
      }
      setDangerZoneUnlockModalOpen(false)
      setDangerZoneUnlockInput('')
      setDangerZoneUnlockError('')
      setDangerZoneUnlocked(false)
      setToken('')
      setCurrentUser(null)
      setIsUserMenuOpen(false)
      setIsChangePasswordOpen(false)
      setShowIntro(false)
      setOk(UI_STATUS.sessionClosed)
    }
  }

  function openChangePassword() {
    setIsUserMenuOpen(true)
    setIsChangePasswordOpen(true)
    setChangePasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }

  function closeChangePassword() {
    setIsChangePasswordOpen(false)
    setIsChangingPassword(false)
    setChangePasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }

  function toggleUserMenu() {
    if (isUserMenuOpen) {
      if (isChangePasswordOpen) closeChangePassword()
      setIsUserMenuOpen(false)
      return
    }
    setIsUserMenuOpen(true)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword) {
      setErr('Completa clave actual y nueva clave.')
      return
    }
    if (changePasswordForm.newPassword.length < 8) {
      setErr('La nueva clave debe tener al menos 8 caracteres.')
      return
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setErr('La confirmacion de clave no coincide.')
      return
    }

    setIsChangingPassword(true)
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: changePasswordForm.currentPassword,
          newPassword: changePasswordForm.newPassword,
        },
      })
      setOk('Clave actualizada correctamente.')
      closeChangePassword()
    } catch (err) {
      setErr(err, 'No se pudo actualizar la clave.')
      setIsChangingPassword(false)
    }
  }

  function armDangerZoneAutoLock() {
    if (dangerZoneLockTimerRef.current) {
      clearTimeout(dangerZoneLockTimerRef.current)
      dangerZoneLockTimerRef.current = null
    }
    dangerZoneLockTimerRef.current = setTimeout(() => {
      setDangerZoneUnlocked(false)
      dangerZoneLockTimerRef.current = null
    }, DANGER_ZONE_UNLOCK_TTL_MS)
  }

  async function unlockDangerZoneButtons() {
    if (dangerZoneUnlocking) return
    if (!dangerZoneUnlockPassword) {
      setErr('Falta configurar VITE_DANGER_ZONE_UNLOCK_PASSWORD en frontend.')
      return
    }
    setDangerZoneUnlockInput('')
    setDangerZoneUnlockError('')
    setDangerZoneUnlockModalOpen(true)
  }

  function closeDangerZoneUnlockModal() {
    if (dangerZoneUnlocking) return
    setDangerZoneUnlockModalOpen(false)
    setDangerZoneUnlockInput('')
    setDangerZoneUnlockError('')
  }

  async function submitDangerZoneUnlock(e) {
    e?.preventDefault?.()
    if (dangerZoneUnlocking) return
    const secret = String(dangerZoneUnlockInput || '').trim()
    if (!secret) {
      setDangerZoneUnlockError('Debes ingresar la contrasena.')
      return
    }

    setDangerZoneUnlocking(true)
    setDangerZoneUnlockError('')
    try {
      if (secret !== dangerZoneUnlockPassword) throw new Error('Contrasena incorrecta.')
      setDangerZoneUnlocked(true)
      armDangerZoneAutoLock()
      setDangerZoneUnlockModalOpen(false)
      setDangerZoneUnlockInput('')
      setDangerZoneUnlockError('')
      setOk('Botones criticos desbloqueados por 10 minutos.')
    } catch {
      setDangerZoneUnlocked(false)
      setDangerZoneUnlockError('Contrasena incorrecta.')
    } finally {
      setDangerZoneUnlocking(false)
    }
  }

  function lockDangerZoneButtons() {
    if (dangerZoneLockTimerRef.current) {
      clearTimeout(dangerZoneLockTimerRef.current)
      dangerZoneLockTimerRef.current = null
    }
    setDangerZoneUnlocked(false)
    setOk('Botones criticos bloqueados.')
  }

  return {
    login,
    setLogin,
    showIntro,
    closeIntro,
    isLoginLoading,
    loginErrorModal,
    setLoginErrorModal,
    isUserMenuOpen,
    isChangePasswordOpen,
    isChangingPassword,
    dangerZoneUnlocked,
    dangerZoneUnlocking,
    dangerZoneUnlockModalOpen,
    dangerZoneUnlockInput,
    setDangerZoneUnlockInput,
    dangerZoneUnlockError,
    setDangerZoneUnlockError,
    changePasswordForm,
    setChangePasswordForm,
    handleLogin,
    handleLogout,
    openChangePassword,
    closeChangePassword,
    toggleUserMenu,
    handleChangePassword,
    unlockDangerZoneButtons,
    closeDangerZoneUnlockModal,
    submitDangerZoneUnlock,
    lockDangerZoneButtons,
  }
}

export default useSessionAdmin
