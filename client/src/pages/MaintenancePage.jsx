import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiTool, FiRefreshCw, FiAlertCircle } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

function MaintenancePage() {
  const { user, maintenance, refreshMaintenance } = useAuth()
  const navigate = useNavigate()

  const [isChecking, setIsChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [lastChecked, setLastChecked] = useState(new Date())

  useEffect(() => {
    if (maintenance.checked && !maintenance.enabled) {
      navigate(user ? '/dashboard' : '/login', { replace: true })
    }
  }, [maintenance.checked, maintenance.enabled, user, navigate])

  const handleCheckNow = async () => {
    setIsChecking(true)
    setCheckError('')
    try {
      const stillEnabled = await refreshMaintenance()
      setLastChecked(new Date())
      if (stillEnabled === null) {
        setCheckError('Unable to reach the server. Please check your connection and try again.')
      }
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-secondary to-tertiary px-6 py-12">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      <div className="absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-quaternary/20" />
      <div className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/95 p-8 text-center shadow-2xl backdrop-blur">
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-quaternary/30" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-quaternary text-white">
            <FiTool size={28} />
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-800">Under Maintenance</h1>
        <p className="mt-2 text-sm text-slate-500">
          {maintenance.message ||
            'We are performing scheduled maintenance. Only administrators can access the system right now.'}
        </p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-xs text-slate-500">
          <p className="font-medium text-slate-600">What&apos;s happening?</p>
          <p className="mt-1">
            The system is temporarily unavailable for regular employees while we finish some
            updates. This page checks automatically and will redirect you once everything is back
            online.
          </p>
        </div>

        {checkError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-left text-xs text-red-500">
            <FiAlertCircle size={14} className="shrink-0" />
            {checkError}
          </div>
        )}

        <button
          type="button"
          onClick={handleCheckNow}
          disabled={isChecking}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-quaternary py-2.5 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FiRefreshCw className={isChecking ? 'animate-spin' : ''} size={16} />
          {isChecking ? 'Checking...' : 'Check Again'}
        </button>

        <p className="mt-4 text-xs text-slate-400">Last checked at {lastChecked.toLocaleTimeString()}</p>
      </div>
    </div>
  )
}

export default MaintenancePage
