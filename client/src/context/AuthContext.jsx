import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { clearTableStates } from '../hooks/useTableQueryState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const MAINTENANCE_POLL_INTERVAL = 20000
const PENDING_POLL_INTERVAL = 30000
const EMPTY_PENDING_BY_TYPE = { eligibility: 0, submission: 0 }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [maintenance, setMaintenance] = useState({ checked: false, enabled: false, message: '' })
  const [pendingCount, setPendingCount] = useState(0)
  // Waiting requests per Members tab, shown as a badge on each tab.
  const [pendingByType, setPendingByType] = useState(EMPTY_PENDING_BY_TYPE)

  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings/maintenance`)
      const data = await res.json()
      if (res.ok) {
        setMaintenance({ checked: true, enabled: Boolean(data.maintenanceMode), message: data.message || '' })
        return Boolean(data.maintenanceMode)
      }
    } catch {
      // Keep the last known status if this check itself fails (e.g. offline).
    }
    return null
  }, [])

  // 'development' | 'production', switched by admin in Settings; shown as a banner when development.
  const [appMode, setAppMode] = useState('production')

  const fetchAppMode = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings/app-mode`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAppMode(data.appMode)
      }
    } catch {
      // Keep the last known mode if this check fails (e.g. offline).
    }
  }, [])

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchMaintenanceStatus(), fetchMe()])
      setIsLoading(false)
    }
    init()
  }, [fetchMaintenanceStatus, fetchMe])

  useEffect(() => {
    const interval = setInterval(async () => {
      const enabled = await fetchMaintenanceStatus()
      if (enabled) {
        setUser((current) => {
          if (current && current.role !== 'admin') {
            fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
            return null
          }
          return current
        })
      }
    }, MAINTENANCE_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchMaintenanceStatus])

  const refreshPending = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/promotions/pending-count`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPendingCount(data.pending || 0)
        setPendingByType(data.byType || EMPTY_PENDING_BY_TYPE)
      }
    } catch {
      // Keep the last known count if this check fails (e.g. offline).
    }
  }, [])

  const isLoggedIn = Boolean(user)

  useEffect(() => {
    if (!isLoggedIn) {
      setAppMode('production')
      return
    }
    fetchAppMode()
  }, [isLoggedIn, fetchAppMode])

  const isApprover = Boolean(user?.isSuperiorOrHod)

  useEffect(() => {
    if (!isApprover) return undefined

    refreshPending()
    const interval = setInterval(refreshPending, PENDING_POLL_INTERVAL)
    return () => {
      clearInterval(interval)
      setPendingCount(0)
      setPendingByType(EMPTY_PENDING_BY_TYPE)
    }
  }, [isApprover, refreshPending])

  // Employees waiting for this judge's assessment, shown as a badge on Judges in the sidebar.
  const [judgingPendingCount, setJudgingPendingCount] = useState(0)

  const refreshJudgingPending = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/judging/pending-count`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setJudgingPendingCount(data.pending || 0)
      }
    } catch {
      // Keep the last known count if this check fails (e.g. offline).
    }
  }, [])

  const isJudge = Boolean(user?.isJudge)

  useEffect(() => {
    if (!isJudge) return undefined

    refreshJudgingPending()
    const interval = setInterval(refreshJudgingPending, PENDING_POLL_INTERVAL)
    return () => {
      clearInterval(interval)
      setJudgingPendingCount(0)
    }
  }, [isJudge, refreshJudgingPending])

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      clearTableStates()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isLoading,
        logout,
        maintenance,
        refreshMaintenance: fetchMaintenanceStatus,
        appMode,
        refreshAppMode: fetchAppMode,
        pendingCount,
        pendingByType,
        refreshPending,
        judgingPendingCount,
        refreshJudgingPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
