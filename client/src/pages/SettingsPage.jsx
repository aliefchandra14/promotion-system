import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiTool, FiAlertTriangle, FiLoader } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import AppModeSetting from '../components/AppModeSetting'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function SettingsPage() {
  const { refreshMaintenance } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchStatus = async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`${API_URL}/settings/maintenance`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load settings')
      }

      setMaintenanceMode(Boolean(data.maintenanceMode))
      setMessage(data.message || '')
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/settings/maintenance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ maintenanceMode, message }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update settings')
      }

      toast.success(data.message)
      refreshMaintenance()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">System-wide configuration</p>
      </div>

      {isLoading ? (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <FiLoader className="animate-spin text-slate-400" size={24} />
        </div>
      ) : loadError ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-10 text-center">
          <FiAlertTriangle className="text-red-400" size={28} />
          <p className="text-sm text-red-500">{loadError}</p>
          <button
            type="button"
            onClick={fetchStatus}
            className="rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  maintenanceMode ? 'bg-amber-100 text-amber-600' : 'bg-green-50 text-green-600'
                }`}
              >
                <FiTool size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Maintenance Mode</h2>
                <p className="mt-0.5 max-w-sm text-sm text-slate-500">
                  When enabled, only admin accounts can log in. All other employees are blocked —
                  including those currently logged in — until you turn it off.
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                    maintenanceMode ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                  }`}
                >
                  {maintenanceMode ? 'Maintenance is ON' : 'System is Normal'}
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={maintenanceMode}
              onClick={() => setMaintenanceMode((prev) => !prev)}
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                maintenanceMode ? 'bg-quaternary' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {maintenanceMode && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
              Saving with this ON will immediately block all non-admin employees from logging in
              and log out anyone currently active.
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Message shown to employees (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="e.g. We're upgrading the system, back online around 9 PM."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
            />

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-quaternary px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AppModeSetting />
    </div>
  )
}

export default SettingsPage
