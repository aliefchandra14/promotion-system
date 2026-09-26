import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiSearch,
  FiArrowUp,
  FiArrowDown,
  FiLoader,
  FiCheckCircle,
  FiArchive,
  FiTrash2,
} from 'react-icons/fi'
import Pagination from '../components/Pagination'
import { useTableQueryState } from '../hooks/useTableQueryState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

const STATUS_LABEL = {
  pending_superior: 'Pending Superior',
  pending_hod: 'Pending HOD',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_STYLE = {
  pending_superior: 'bg-amber-50 text-amber-600',
  pending_hod: 'bg-amber-50 text-amber-600',
  approved: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-500',
}

const ADMIN_DECISION_LABEL = {
  pending: 'Pending Admin',
  eligible_for_submission: 'Eligible for Submission',
  summarized: 'Summarized',
}

const ADMIN_DECISION_STYLE = {
  pending: 'bg-slate-100 text-slate-500',
  eligible_for_submission: 'bg-blue-50 text-blue-600',
  summarized: 'bg-purple-50 text-purple-600',
}

const columns = [
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'name', label: 'Name' },
  { field: 'department', label: 'Department' },
  { field: 'currentGrade', label: 'Current Grade' },
  { field: 'promoteGrade', label: 'Promote Grade' },
  { field: 'type', label: 'Type' },
  { field: 'presentation', label: 'Presentation' },
]

function EligibilityMonitoringPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isActing, setIsActing] = useState(false)
  const [counts, setCounts] = useState({ active: 0, rejected: 0 })

  const [table, updateTable] = useTableQueryState({
    view: 'active',
    search: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: 1,
  })
  const { view, search: debouncedSearch, status, sortBy, sortOrder, page } = table
  const isRejectedView = view === 'rejected'
  const columnCount = columns.length + 4 + (isRejectedView ? 0 : 1)

  const [searchInput, setSearchInput] = useState(debouncedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTable({ search: searchInput }, { resetPage: true })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({
        view,
        search: debouncedSearch,
        status,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/promotions/eligibility-monitor?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load data')
      }

      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setCounts(data.counts || { active: 0, rejected: 0 })
      setSelectedIds(new Set())
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [view, debouncedSearch, status, sortBy, sortOrder, page])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleSort = (field) => {
    if (sortBy === field) {
      updateTable({ sortOrder: sortOrder === 'ASC' ? 'DESC' : 'ASC' }, { resetPage: true })
    } else {
      updateTable({ sortBy: field, sortOrder: 'ASC' }, { resetPage: true })
    }
  }

  const renderSortIcon = (field) => {
    if (sortBy !== field) return <span className="text-slate-300">↕</span>
    return sortOrder === 'ASC' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />
  }

  const toggleSelect = (employeeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.employeeId))))
  }

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return

    if (action === 'delete') {
      const confirmed = window.confirm(
        `Delete ${selectedIds.size} employee promotion record(s)? This also removes their eligibility/submission requests and cannot be undone.`
      )
      if (!confirmed) return
    }

    setIsActing(true)
    try {
      const res = await fetch(`${API_URL}/promotions/eligibility-monitor/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeIds: Array.from(selectedIds), action }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to perform action')
      }

      toast.success(data.message)
      fetchItems()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsActing(false)
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Eligibility Monitoring</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track every employee's eligibility approval progress for the active period. Rejected employees are listed separately.
        </p>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {[
          { key: 'active', label: 'In Progress', count: counts.active },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => updateTable({ view: key, status: '' }, { resetPage: true })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              view === key
                ? 'border-quaternary text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                key === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-50 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by ID or name"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>

        {!isRejectedView && (
          <select
            value={status}
            onChange={(e) => updateTable({ status: e.target.value }, { resetPage: true })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          >
            <option value="">All Status</option>
            <option value="pending_superior">Pending Superior</option>
            <option value="pending_hod">Pending HOD</option>
            <option value="approved">Approved</option>
          </select>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-tertiary/30 bg-tertiary/5 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">{selectedIds.size} selected</span>
          {!isRejectedView && (
            <>
              <button
                type="button"
                onClick={() => handleBulkAction('eligible_for_submission')}
                disabled={isActing}
                className="flex items-center gap-1.5 rounded-lg bg-quaternary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle size={14} /> Eligible for Submission
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('summarized')}
                disabled={isActing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiArchive size={14} /> Move to Summary
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => handleBulkAction('delete')}
            disabled={isActing}
            className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiTrash2 size={14} /> Delete
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-max min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-quaternary focus:ring-quaternary/30"
                />
              </th>
              {columns.map(({ field, label }) => (
                <th key={field} className="whitespace-nowrap px-4 py-3">
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
              <th className="whitespace-nowrap px-4 py-3">Eligibility Status</th>
              <th className="whitespace-nowrap px-4 py-3">Superior Remark</th>
              <th className="whitespace-nowrap px-4 py-3">HOD Remark</th>
              {!isRejectedView && <th className="whitespace-nowrap px-4 py-3">Admin Decision</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-400">
                  <FiLoader className="mx-auto animate-spin" size={20} />
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center">
                  <p className="text-sm text-red-500">{loadError}</p>
                  <button
                    type="button"
                    onClick={fetchItems}
                    className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
                  >
                    Try Again
                  </button>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  {isRejectedView ? 'No rejected employees' : 'No promotion candidates found'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.employeeId)}
                      onChange={() => toggleSelect(item.employeeId)}
                      className="h-4 w-4 rounded border-slate-300 text-quaternary focus:ring-quaternary/30"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{item.employeeId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.employee?.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {item.employee?.department || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {item.promotion?.currentGrade || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {item.promotion?.promoteGrade || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.promotion?.type || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.promotion?.presentation === 'YES'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.promotion?.presentation || 'NO'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </td>
                  <td className="max-w-40 truncate px-4 py-3 text-slate-500">{item.superiorRemark || '-'}</td>
                  <td className="max-w-40 truncate px-4 py-3 text-slate-500">{item.hodRemark || '-'}</td>
                  {!isRejectedView && (
                    <td className="whitespace-nowrap px-4 py-3">
                      {item.status === 'approved' ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            ADMIN_DECISION_STYLE[item.promotion?.adminDecision || 'pending']
                          }`}
                        >
                          {ADMIN_DECISION_LABEL[item.promotion?.adminDecision || 'pending']}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPageChange={(newPage) => updateTable({ page: newPage })}
          />
        )}
      </div>
    </div>
  )
}

export default EligibilityMonitoringPage
