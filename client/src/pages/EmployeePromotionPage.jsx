import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiUpload, FiArrowUp, FiArrowDown, FiEdit2 } from 'react-icons/fi'
import Pagination from '../components/Pagination'
import EmployeePromotionEditModal from '../components/EmployeePromotionEditModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

const columns = [
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'name', label: 'Name' },
  { field: 'department', label: 'Department' },
  { field: 'currentGrade', label: 'Current Grade' },
  { field: 'promoteGrade', label: 'Promote Grade' },
  { field: 'type', label: 'Type' },
  { field: 'presentation', label: 'Presentation' },
  { field: 'status', label: 'Status' },
]

function EmployeePromotionPage() {
  const fileInputRef = useRef(null)

  const [promotions, setPromotions] = useState([])
  const [periode, setPeriode] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [presentation, setPresentation] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('DESC')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchPromotions = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        status,
        presentation,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/employee-promotions?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load promotion data')
      }

      setPromotions(data.promotions)
      setPeriode(data.periode)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, presentation, sortBy, sortOrder, page])

  useEffect(() => {
    fetchPromotions()
  }, [fetchPromotions])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(field)
      setSortOrder('ASC')
    }
    setPage(1)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setIsImporting(true)
    try {
      const res = await fetch(`${API_URL}/employee-promotions/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Import failed')
      }

      toast.success(data.message)
      data.errors?.forEach((err) => toast.error(err, { duration: 6000 }))
      setPage(1)
      fetchPromotions()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsImporting(false)
      e.target.value = ''
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
          <h1 className="text-2xl font-bold text-slate-800">Employee Promotion</h1>
          <p className="mt-1 text-sm text-slate-500">
            {periode ? `Period: ${periode.name}` : 'No period available yet'}
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiUpload size={16} />
            {isImporting ? 'Importing...' : 'Import Excel'}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or name"
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
          <option value="NORMAL">NORMAL</option>
          <option value="SPECIAL">SPECIAL</option>
        </select>

        <select
          value={presentation}
          onChange={(e) => {
            setPresentation(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Presentation</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columns.map(({ field, label }) => (
                <th key={field} className="px-4 py-3 whitespace-nowrap">
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
              <th className="px-4 py-3">Remark</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : promotions.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                  No promotion data found
                </td>
              </tr>
            ) : (
              promotions.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.department || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.currentGrade || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.promoteGrade || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.type || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.presentation === 'YES'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.presentation}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.status === 'SPECIAL'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="max-w-50 truncate px-4 py-3 text-slate-500">{item.remark || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingPromotion(item)}
                      className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary"
                    >
                      <FiEdit2 size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
      </div>

      {editingPromotion && (
        <EmployeePromotionEditModal
          promotion={editingPromotion}
          onClose={() => setEditingPromotion(null)}
          onSaved={() => {
            setEditingPromotion(null)
            fetchPromotions()
          }}
        />
      )}
    </div>
  )
}

export default EmployeePromotionPage
