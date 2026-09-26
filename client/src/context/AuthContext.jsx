import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { clearTableStates } from '../hooks/useTableQueryState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const MAINTENANCE_POLL_INTERVAL = 20000
const PENDING_POLL_INTERVAL = 30000

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [maintenance, setMaintenance] = useState({ checked: false, enabled: false, message: '' })
  const [pendingCount, setPendingCount] = useState(0)

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
      }
    } catch {
      // Keep the last known count if this check fails (e.g. offline).
    }
  }, [])

  const isApprover = Boolean(user?.isSuperiorOrHod)

  useEffect(() => {
    if (!isApprover) return undefined

    refreshPending()
    const interval = setInterval(refreshPending, PENDING_POLL_INTERVAL)
    return () => {
      clearInterval(interval)
      setPendingCount(0)
    }
  }, [isApprover, refreshPending])

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
        pendingCount,
        refreshPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
