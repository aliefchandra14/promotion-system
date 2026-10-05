import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiPauseCircle, FiBell, FiX, FiCalendar, FiLoader, FiEdit2 } from 'react-icons/fi'
import { useTableQueryState } from '../hooks/useTableQueryState'
import { getFiscalYearOptions, getFiscalYearLabel, getCurrentFiscalYear } from '../constants/fiscalYear'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const statusStyle = {
  draft: 'bg-slate-100 text-slate-500',
  active: 'bg-green-50 text-green-600',
  completed: 'bg-blue-50 text-blue-600',
}

// Dates arrive as "YYYY-MM-DD"; build them locally so the shown day never shifts with the time zone.
const formatDate = (value) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

function EditDatesModal({ periode, onClose, onSaved }) {
  const [form, setForm] = useState({ startDate: periode.startDate, endDate: periode.endDate })
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.endDate < form.startDate) {
      toast.error('The end date cannot be before the start date')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/periodes/${periode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update period dates')

      toast.success(data.message)
      onSaved()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Edit Dates</h2>
            <p className="text-xs text-slate-500">
              {periode.name} · {getFiscalYearLabel(periode.fiscalYear)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">End Date</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : 'Save Dates'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PeriodCard({ periode, isBusy, onActivate, onDeactivate, onSendReminder, onEditDates }) {
  const isActive = periode.status === 'active'

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {getFiscalYearLabel(periode.fiscalYear)}
          </span>
          <h3 className="mt-2 text-base font-semibold text-slate-800">{periode.name}</h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
            statusStyle[periode.status] || 'bg-slate-100 text-slate-500'
          }`}
        >
          {periode.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <FiCalendar size={14} />
          {formatDate(periode.startDate)} - {formatDate(periode.endDate)}
        </span>
        <button
          type="button"
          onClick={() => onEditDates(periode)}
          disabled={isBusy}
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-secondary hover:text-primary disabled:opacity-50"
        >
          <FiEdit2 size={13} /> Edit Dates
        </button>
      </div>

      <div className="mt-5 flex flex-1 items-end gap-2">
        {isActive ? (
          <button
            type="button"
            onClick={() => onDeactivate(periode)}
            disabled={isBusy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiPauseCircle size={14} />
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onActivate(periode)}
            disabled={isBusy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-quaternary py-2 text-xs font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiCheckCircle size={14} />
            Activate
          </button>
        )}

        {isActive && (
          <button
            type="button"
            onClick={() => onSendReminder(periode)}
            disabled={isBusy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-semibold text-white shadow-sm shadow-secondary/30 transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiBell size={14} />
            Send Reminder
          </button>
        )}
      </div>
    </div>
  )
}

function PeriodePage() {
  const [periodes, setPeriodes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [editing, setEditing] = useState(null)

  // Each fiscal year has exactly Periode 1 & Periode 2; the current FY is shown by default.
  const [table, updateTable] = useTableQueryState({ fiscalYear: String(getCurrentFiscalYear()) })
  const { fiscalYear } = table

  const fetchPeriodes = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({ fiscalYear, sortBy: 'name', sortOrder: 'ASC' })
      const res = await fetch(`${API_URL}/periodes?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load period data')
      setPeriodes(data.periodes)
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [fiscalYear])

  useEffect(() => {
    fetchPeriodes()
  }, [fetchPeriodes])

  // Runs one period action and reloads the list; `reload: false` for actions that do not change it.
  const runAction = async (periode, path, method, fallbackError, { reload = true } = {}) => {
    setBusyId(periode.id)
    try {
      const res = await fetch(`${API_URL}/periodes/${periode.id}/${path}`, { method, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || fallbackError)

      toast.success(data.message)
      if (reload) fetchPeriodes()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  const handleActivate = (periode) => runAction(periode, 'activate', 'PATCH', 'Failed to activate period')
  const handleDeactivate = (periode) => runAction(periode, 'deactivate', 'PATCH', 'Failed to deactivate period')
  const handleSendReminder = (periode) =>
    runAction(periode, 'send-reminder', 'POST', 'Failed to send reminder', { reload: false })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Period</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every fiscal year has two promotion periods, Periode 1 and Periode 2, prepared automatically.
          </p>
        </div>

        <select
          value={fiscalYear}
          onChange={(e) => updateTable({ fiscalYear: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          {getFiscalYearOptions(3, 0)
            .reverse()
            .map((fy) => (
              <option key={fy} value={fy}>
                {getFiscalYearLabel(fy)}
              </option>
            ))}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <FiLoader className="animate-spin text-slate-400" size={24} />
        </div>
      ) : loadError ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-10 text-center">
          <p className="text-sm text-red-500">{loadError}</p>
          <button
            type="button"
            onClick={fetchPeriodes}
            className="rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90"
          >
            Try Again
          </button>
        </div>
      ) : periodes.length === 0 ? (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
          No periods for {getFiscalYearLabel(fiscalYear)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {periodes.map((periode) => (
            <PeriodCard
              key={periode.id}
              periode={periode}
              isBusy={busyId === periode.id}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onSendReminder={handleSendReminder}
              onEditDates={setEditing}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditDatesModal
          periode={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchPeriodes()
          }}
        />
      )}
    </div>
  )
}

export default PeriodePage
