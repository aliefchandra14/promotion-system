import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiSearch,
  FiPlus,
  FiCheckCircle,
  FiPauseCircle,
  FiBell,
  FiTrash2,
  FiX,
  FiCalendar,
  FiLoader,
} from 'react-icons/fi'
import Pagination from '../components/Pagination'
import { useTableQueryState } from '../hooks/useTableQueryState'
import { getFiscalYearOptions, getFiscalYearLabel, getCurrentFiscalYear } from '../constants/fiscalYear'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 9

const statusStyle = {
  draft: 'bg-slate-100 text-slate-500',
  active: 'bg-green-50 text-green-600',
  completed: 'bg-blue-50 text-blue-600',
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

function CreatePeriodModal({ onClose, onCreated }) {
  const fiscalYearOptions = getFiscalYearOptions()
  const [form, setForm] = useState({
    name: '',
    fiscalYear: String(getCurrentFiscalYear()),
    startDate: '',
    endDate: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/periodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create period')
      }

      toast.success(data.message)
      onCreated()
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
          <h2 className="text-lg font-semibold text-slate-800">Create Period</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Period Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Periode 1"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fiscal Year</label>
            <select
              value={form.fiscalYear}
              onChange={(e) => setForm((prev) => ({ ...prev, fiscalYear: e.target.value }))}
              className={inputClass}
            >
              {fiscalYearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  {getFiscalYearLabel(fy)}
                </option>
              ))}
            </select>
          </div>
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
            {isSaving ? 'Creating...' : 'Create Period'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PeriodCard({ periode, isBusy, onActivate, onDeactivate, onSendReminder, onDelete }) {
  const isActive = periode.status === 'active'

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={() => onDelete(periode)}
        disabled={isBusy || isActive}
        title={isActive ? 'Deactivate this period before deleting it' : 'Delete period'}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
      >
        <FiTrash2 size={15} />
      </button>

      <div className="flex items-start justify-between gap-2 pr-7">
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

      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        <FiCalendar size={14} />
        {formatDate(periode.startDate)} - {formatDate(periode.endDate)}
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
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const [table, updateTable] = useTableQueryState({
    search: '',
    status: '',
    fiscalYear: '',
    sortBy: 'startDate',
    sortOrder: 'DESC',
    page: 1,
  })
  const { search: debouncedSearch, status, fiscalYear, sortBy, sortOrder, page } = table

  const [searchInput, setSearchInput] = useState(debouncedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTable({ search: searchInput }, { resetPage: true })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const fetchPeriodes = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        status,
        fiscalYear,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/periodes?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load period data')
      }

      setPeriodes(data.periodes)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, fiscalYear, sortBy, sortOrder, page])

  useEffect(() => {
    fetchPeriodes()
  }, [fetchPeriodes])

  const handleSortChange = (value) => {
    const [field, order] = value.split(':')
    updateTable({ sortBy: field, sortOrder: order }, { resetPage: true })
  }

  const handleActivate = async (periode) => {
    setBusyId(periode.id)
    try {
      const res = await fetch(`${API_URL}/periodes/${periode.id}/activate`, {
        method: 'PATCH',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to activate period')
      }

      toast.success(data.message)
      fetchPeriodes()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  const handleDeactivate = async (periode) => {
    setBusyId(periode.id)
    try {
      const res = await fetch(`${API_URL}/periodes/${periode.id}/deactivate`, {
        method: 'PATCH',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to deactivate period')
      }

      toast.success(data.message)
      fetchPeriodes()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (periode) => {
    if (!window.confirm(`Delete "${periode.name}"? This action cannot be undone.`)) {
      return
    }

    setBusyId(periode.id)
    try {
      const res = await fetch(`${API_URL}/periodes/${periode.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete period')
      }

      toast.success(data.message)
      fetchPeriodes()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  const handleSendReminder = async (periode) => {
    setBusyId(periode.id)
    try {
      const res = await fetch(`${API_URL}/periodes/${periode.id}/send-reminder`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send reminder')
      }

      toast.success(data.message)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Period</h1>
          <p className="mt-1 text-sm text-slate-500">List of promotion periods</p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90"
        >
          <FiPlus size={16} />
          Create Period
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-50 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by period name"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>

        <select
          value={status}
          onChange={(e) => updateTable({ status: e.target.value }, { resetPage: true })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={fiscalYear}
          onChange={(e) => updateTable({ fiscalYear: e.target.value }, { resetPage: true })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Fiscal Years</option>
          {getFiscalYearOptions().map((fy) => (
            <option key={fy} value={fy}>
              {getFiscalYearLabel(fy)}
            </option>
          ))}
        </select>

        <select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => handleSortChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="startDate:DESC">Newest First</option>
          <option value="startDate:ASC">Oldest First</option>
          <option value="name:ASC">Name (A-Z)</option>
          <option value="name:DESC">Name (Z-A)</option>
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
          No period data found
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periodes.map((periode) => (
            <PeriodCard
              key={periode.id}
              periode={periode}
              isBusy={busyId === periode.id}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onSendReminder={handleSendReminder}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPageChange={(newPage) => updateTable({ page: newPage })}
          />
        </div>
      )}

      {isCreateOpen && (
        <CreatePeriodModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            fetchPeriodes()
          }}
        />
      )}
    </div>
  )
}

export default PeriodePage
