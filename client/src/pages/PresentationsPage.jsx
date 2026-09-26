import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiSearch, FiArrowUp, FiArrowDown, FiEdit2, FiBell, FiCheck } from 'react-icons/fi'
import Pagination from '../components/Pagination'
import PresentationModal from '../components/PresentationModal'
import ReminderModal from '../components/ReminderModal'
import { useTableQueryState } from '../hooks/useTableQueryState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

// One reminder can be sent per stage of a grade's schedule.
const REMINDERS = [
  { type: 'briefing', label: 'Briefing' },
  { type: 'submission', label: 'Submission' },
  { type: 'presentation', label: 'Presentation' },
]

const formatSentAt = (value) =>
  new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const columns = [
  { field: 'grade', label: 'Grade' },
  { field: 'briefingStart', label: 'Briefing' },
  { field: 'submissionStart', label: 'Submission' },
  { field: 'presentationStart', label: 'Presentation' },
  { field: 'isOpen', label: 'Status' },
]

// Dates arrive as "YYYY-MM-DD"; build them locally so the shown day never shifts with the time zone.
const formatDate = (value) => {
  if (!value) return '-'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatRange = (start, end) => `${formatDate(start)} – ${formatDate(end)}`

// The submission end date is inclusive, so it is over from the next day.
const isEnded = (endDate) => {
  if (!endDate) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return endDate < today
}

function PresentationsPage() {
  const [presentations, setPresentations] = useState([])
  const [periode, setPeriode] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { presentation: null | row }
  const [reminder, setReminder] = useState(null) // null | { presentation: row, type }
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

  const fetchPresentations = useCallback(async () => {
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

      const res = await fetch(`${API_URL}/presentations?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load presentations')
      }

      if (requestId !== latestRequest.current) return
      setPresentations(data.presentations)
      setPeriode(data.periode)
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
    fetchPresentations()
  }, [fetchPresentations])

  const handleSort = (field) => {
    if (sortBy === field) {
      updateTable({ sortOrder: sortOrder === 'ASC' ? 'DESC' : 'ASC' }, { resetPage: true })
    } else {
      updateTable({ sortBy: field, sortOrder: 'ASC' }, { resetPage: true })
    }
  }

  const handleSaved = () => {
    setModal(null)
    fetchPresentations()
  }

  const renderSortIcon = (field) => {
    if (sortBy !== field) return <span className="text-slate-300">↕</span>
    return sortOrder === 'ASC' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />
  }

  const columnCount = columns.length + 2

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presentations</h1>
          <p className="mt-1 text-sm text-slate-500">
            {periode
              ? `Grades opened for briefing, submission and presentation in ${periode.name}`
              : 'Open grades for briefing, submission and presentation'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModal({ presentation: null })}
          className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90"
        >
          <FiPlus size={16} />
          Add Presentation
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
            placeholder="Search by grade"
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
              <th className="whitespace-nowrap px-4 py-3">Reminders</th>
              <th className="whitespace-nowrap px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : !periode ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  There is no active period. Activate a period first, then add presentations.
                </td>
              </tr>
            ) : presentations.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  No presentation found. Use "Add Presentation" to open a grade.
                </td>
              </tr>
            ) : (
              presentations.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.grade}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatRange(row.briefingStart, row.briefingEnd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatRange(row.submissionStart, row.submissionEnd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatRange(row.presentationStart, row.presentationEnd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        row.isOpen ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {row.isOpen ? 'Open' : 'Closed'}
                    </span>
                    {!row.isOpen && isEnded(row.submissionEnd) && (
                      <span className="ml-2 text-xs text-slate-400">submission ended</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {REMINDERS.map(({ type, label }) => {
                        const last = row.reminders?.[type]
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setReminder({ presentation: row, type })}
                            title={
                              last
                                ? `Last sent ${formatSentAt(last.sentAt)} to ${last.sentCount} employee(s)${last.simulated ? ' (logged only)' : ''}`
                                : `Send ${label.toLowerCase()} reminder`
                            }
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                              last
                                ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {last ? <FiCheck size={12} /> : <FiBell size={12} />}
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setModal({ presentation: row })}
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

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={(newPage) => updateTable({ page: newPage })}
        />
      </div>

      {modal && (
        <PresentationModal
          presentation={modal.presentation}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {reminder && (
        <ReminderModal
          key={`${reminder.presentation.id}-${reminder.type}`}
          presentation={reminder.presentation}
          type={reminder.type}
          onClose={() => setReminder(null)}
          onSent={() => {
            setReminder(null)
            fetchPresentations()
          }}
        />
      )}
    </div>
  )
}

export default PresentationsPage
