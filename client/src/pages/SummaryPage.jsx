import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiArrowUp, FiArrowDown, FiPlus, FiUploadCloud } from 'react-icons/fi'
import Pagination from '../components/Pagination'
import ManualSummaryModal from '../components/ManualSummaryModal'
import UploadSummaryModal from '../components/UploadSummaryModal'
import { useTableQueryState } from '../hooks/useTableQueryState'
import { getFiscalYearLabel } from '../constants/fiscalYear'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const STATUS_STYLE = {
  'Not Recommended': 'bg-red-50 text-red-500',
  'Pending 6 Month': 'bg-amber-50 text-amber-600',
}

const LIMIT = 10

const columns = [
  { field: 'name', label: 'Name' },
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'department', label: 'Department' },
  { field: 'currentGrade', label: 'Current Grade' },
  { field: 'promoteGrade', label: 'Promote Grade' },
  { field: 'fiscalYear', label: 'FY' },
  { field: 'periodeName', label: 'Periode' },
  { field: 'type', label: 'Type' },
  { field: 'presentation', label: 'Presentation' },
  { field: 'status', label: 'Status' },
  { field: 'remark', label: 'Remark' },
]

function SummaryPage() {
  const [summaries, setSummaries] = useState([])
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const latestRequest = useRef(0)

  const [table, updateTable] = useTableQueryState({
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: 1,
  })
  const { search: debouncedSearch, sortBy, sortOrder, page } = table

  const [searchInput, setSearchInput] = useState(debouncedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTable({ search: searchInput }, { resetPage: true })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const fetchSummaries = useCallback(async () => {
    const requestId = ++latestRequest.current
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/summaries?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load summary data')
      }

      if (requestId !== latestRequest.current) return
      setSummaries(data.summaries)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      if (requestId === latestRequest.current) {
        toast.error(error.message || 'Something went wrong, please try again')
      }
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false)
    }
  }, [debouncedSearch, sortBy, sortOrder, page])

  useEffect(() => {
    fetchSummaries()
  }, [fetchSummaries])

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Summary</h1>
          <p className="mt-1 text-sm text-slate-500">
            Employees appear here automatically once their promotion process is finished, or when added manually
            (type PTC).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FiUploadCloud size={16} />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setIsManualOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90"
          >
            <FiPlus size={16} />
            Add Manual
          </button>
        </div>
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
            placeholder="Search in all columns"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : summaries.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                  No summary data found
                </td>
              </tr>
            ) : (
              summaries.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600">{row.department || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.currentGrade || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.promoteGrade || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {getFiscalYearLabel(row.fiscalYear)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.periodeName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.type || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.presentation}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLE[row.status] || 'bg-green-50 text-green-600'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.remark || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={(newPage) => updateTable({ page: newPage })} />
      </div>

      {isUploadOpen && <UploadSummaryModal onClose={() => setIsUploadOpen(false)} onUploaded={fetchSummaries} />}

      {isManualOpen && (
        <ManualSummaryModal
          onClose={() => setIsManualOpen(false)}
          onSaved={() => {
            setIsManualOpen(false)
            fetchSummaries()
          }}
        />
      )}
    </div>
  )
}

export default SummaryPage
