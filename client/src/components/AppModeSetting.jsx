import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiCode, FiAlertTriangle, FiLoader } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const MODES = [
  {
    value: 'production',
    label: 'Production',
    description: 'Emails are sent and presentation dates are enforced.',
  },
  {
    value: 'development',
    label: 'Development',
    description: 'No emails are sent and presentation dates are not enforced, so everything can be tested.',
  },
]

function AppModeSetting() {
  const { refreshAppMode } = useAuth()
  const [savedMode, setSavedMode] = useState(null)
  const [appMode, setAppMode] = useState('production')
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchMode = async () => {
    setLoadError('')
    try {
      const res = await fetch(`${API_URL}/settings/app-mode`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load application mode')
      setSavedMode(data.appMode)
      setAppMode(data.appMode)
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    }
  }

  useEffect(() => {
    fetchMode()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/settings/app-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update application mode')

      toast.success(data.message)
      setSavedMode(data.appMode)
      refreshAppMode()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  const isDevelopment = appMode === 'development'

  return (
    <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            savedMode === 'development' ? 'bg-sky-100 text-sky-600' : 'bg-green-50 text-green-600'
          }`}
        >
          <FiCode size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Application Mode</h2>
          <p className="mt-0.5 max-w-md text-sm text-slate-500">
            Use development mode while testing. Switch back to production before real employees use the system.
          </p>
        </div>
      </div>

      {savedMode === null ? (
        loadError ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-red-500">
            {loadError}
            <button
              type="button"
              onClick={fetchMode}
              className="rounded-lg bg-quaternary px-3 py-1 text-xs font-semibold text-white transition hover:bg-quaternary/90"
            >
              Try Again
            </button>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <FiLoader className="animate-spin" size={14} /> Loading...
          </p>
        )
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {MODES.map((mode) => {
              const isSelected = appMode === mode.value
              return (
                <label
                  key={mode.value}
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    isSelected ? 'border-quaternary bg-quaternary/5' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="appMode"
                      value={mode.value}
                      checked={isSelected}
                      onChange={() => setAppMode(mode.value)}
                      disabled={isSaving}
                      className="accent-quaternary"
                    />
                    <span className="text-sm font-semibold text-slate-800">{mode.label}</span>
                    {savedMode === mode.value && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Current</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">{mode.description}</p>
                </label>
              )
            })}
          </div>

          {isDevelopment && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-xs text-sky-700">
              <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
              <p>
                In development mode, notifications, reminders and approval emails are only logged on the server.
                Employees can submit regardless of the presentation dates or the open/closed switch, and past
                dates are accepted when setting up a presentation.
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || appMode === savedMode}
              className="rounded-lg bg-quaternary px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? 'Saving...' : 'Save Mode'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default AppModeSetting
