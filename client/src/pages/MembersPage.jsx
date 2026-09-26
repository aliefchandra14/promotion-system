import { useCallback, useEffect, useState } from 'react'
import { FiCheck, FiX, FiSearch, FiArrowUp, FiArrowDown, FiLoader } from 'react-icons/fi'
import Pagination from '../components/Pagination'
import PromotionDecisionModal from '../components/PromotionDecisionModal'
import { useTableQueryState } from '../hooks/useTableQueryState'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

const TABS = [
  { type: 'eligibility', label: 'Eligible Status Approver' },
  { type: 'submission', label: 'Submission Status Approver' },
]

const columns = [
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'name', label: 'Name' },
  { field: 'department', label: 'Department' },
  { field: 'currentGrade', label: 'Current Grade' },
  { field: 'promoteGrade', label: 'Promote Grade' },
  { field: 'type', label: 'Type' },
  { field: 'toeic', label: 'TOEIC' },
  { field: 'presentation', label: 'Presentation' },
  { field: 'superiorRemark', label: "Superior's Reason" },
  { field: 'stage', label: 'Stage' },
]

function MembersPage() {
  const { refreshPending } = useAuth()
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [decision, setDecision] = useState(null)

  const [table, updateTable] = useTableQueryState({
    tab: 'eligibility',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: 1,
  })
  const { tab: activeTab, search: debouncedSearch, sortBy, sortOrder, page } = table

  const [searchInput, setSearchInput] = useState(debouncedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTable({ search: searchInput }, { resetPage: true })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({
        type: activeTab,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/promotions/members?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load data')
      }

      setRequests(data.requests)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, debouncedSearch, sortBy, sortOrder, page])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

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

  const handleDecided = () => {
    setDecision(null)
    fetchRequests()
    refreshPending()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Members</h1>
      <p className="mt-1 text-sm text-slate-500">Review and approve your team's promotion status</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {TABS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => updateTable({ tab: type }, { resetPage: true })}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === type
                ? 'border-b-2 border-quaternary text-quaternary'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
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
            placeholder="Search in all columns"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-max min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
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
              <th className="whitespace-nowrap px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-400">
                  <FiLoader className="mx-auto animate-spin" size={20} />
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center">
                  <p className="text-sm text-red-500">{loadError}</p>
                  <button
                    type="button"
                    onClick={fetchRequests}
                    className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
                  >
                    Try Again
                  </button>
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-400">
                  Nothing pending your approval
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={`${req.stage}-${req.id}`} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{req.employeeId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{req.employee?.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {req.employee?.department || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {req.promotion?.currentGrade || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {req.promotion?.promoteGrade || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{req.promotion?.type || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {req.promotion?.toeic ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        req.promotion?.presentation === 'YES'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {req.promotion?.presentation || 'NO'}
                    </span>
                  </td>
                  <td className="max-w-40 truncate px-4 py-3 text-slate-500">{req.superiorRemark || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                    {req.stage} approval
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDecision({ request: req, type: 'approve' })}
                        className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600 transition hover:bg-green-100"
                      >
                        <FiCheck size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision({ request: req, type: 'reject' })}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100"
                      >
                        <FiX size={14} /> Reject
                      </button>
                    </div>
                  </td>
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

      {decision && (
        <PromotionDecisionModal
          request={decision.request}
          decision={decision.type}
          onClose={() => setDecision(null)}
          onDecided={handleDecided}
        />
      )}
    </div>
  )
}

export default MembersPage
