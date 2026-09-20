import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiArrowUp, FiArrowDown, FiPlus, FiCheckCircle, FiX } from 'react-icons/fi'
import Pagination from '../components/Pagination'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

const statusStyle = {
  draft: 'bg-slate-100 text-slate-500',
  active: 'bg-green-50 text-green-600',
  completed: 'bg-blue-50 text-blue-600',
}

const columns = [
  { field: 'name', label: 'Period Name' },
  { field: 'startDate', label: 'Start Date' },
  { field: 'endDate', label: 'End Date' },
]

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

function CreatePeriodModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' })
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
              placeholder="e.g. Promotion Q2 2026"
              required
              className={inputClass}
            />
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

function PeriodePage() {
  const [periodes, setPeriodes] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [activatingId, setActivatingId] = useState(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('startDate')
  const [sortOrder, setSortOrder] = useState('DESC')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchPeriodes = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        status,
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
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, sortBy, sortOrder, page])

  useEffect(() => {
    fetchPeriodes()
  }, [fetchPeriodes])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(field)
      setSortOrder('ASC')
    }
    setPage(1)
  }

  const handleActivate = async (id) => {
    setActivatingId(id)
    try {
      const res = await fetch(`${API_URL}/periodes/${id}/activate`, {
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
      setActivatingId(null)
    }
  }

  const renderSortIcon = (field) => {
    if (sortBy !== field) return <span className="text-slate-300">↕</span>
    return sortOrder === 'ASC' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by period name"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columns.map(({ field, label }) => (
                <th key={field} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort(field)}
                    className="flex items-center gap-1.5 font-medium uppercase text-slate-500 hover:text-slate-700"
                  >
                    {label}
                    {renderSortIcon(field)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : periodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No period data found
                </td>
              </tr>
            ) : (
              periodes.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.endDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        statusStyle[p.status] || 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => handleActivate(p.id)}
                        disabled={activatingId === p.id}
                        className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiCheckCircle size={13} />
                        {activatingId === p.id ? 'Activating...' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
      </div>

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
