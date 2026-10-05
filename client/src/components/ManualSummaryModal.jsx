import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiSearch, FiLoader } from 'react-icons/fi'
import { GRADES } from '../constants/grades'
import { getFiscalYearLabel } from '../constants/fiscalYear'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const RESULT_LIMIT = 8
// A manual entry is always type PTC, without a presentation, and recommended (set by the server).
const MANUAL_ENTRY = { type: 'PTC', presentation: 'NO', status: 'Recommended' }

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'
const labelClass = 'mb-1 block text-xs font-medium text-slate-600'

// Admin adds an employee straight into the summary (type PTC, recommended), skipping every approval.
function ManualSummaryModal({ onClose, onSaved }) {
  const [periodes, setPeriodes] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [employee, setEmployee] = useState(null)
  const [form, setForm] = useState({
    periodeId: '',
    currentGrade: '',
    promoteGrade: '',
    remark: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  // Periods to choose from, newest first; the active one is preselected.
  useEffect(() => {
    const loadPeriodes = async () => {
      try {
        const params = new URLSearchParams({ sortBy: 'fiscalYear', sortOrder: 'DESC', limit: '100' })
        const res = await fetch(`${API_URL}/periodes?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to load periods')
        const sorted = [...data.periodes].sort(
          (a, b) => b.fiscalYear - a.fiscalYear || a.name.localeCompare(b.name)
        )
        setPeriodes(sorted)
        const active = sorted.find((periode) => periode.status === 'active')
        setForm((prev) => ({ ...prev, periodeId: String((active || sorted[0])?.id || '') }))
      } catch (error) {
        toast.error(error.message || 'Something went wrong, please try again')
      }
    }
    loadPeriodes()
  }, [])

  useEffect(() => {
    const term = searchInput.trim()
    if (!term || employee) {
      setResults([])
      return undefined
    }

    let ignore = false
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const params = new URLSearchParams({
          search: term,
          status: 'active',
          sortBy: 'name',
          sortOrder: 'ASC',
          limit: String(RESULT_LIMIT),
        })
        const res = await fetch(`${API_URL}/employees?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to search employees')
        if (!ignore) setResults(data.employees.filter((item) => item.role !== 'admin'))
      } catch (error) {
        if (!ignore) toast.error(error.message || 'Something went wrong, please try again')
      } finally {
        if (!ignore) setIsSearching(false)
      }
    }, 300)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [searchInput, employee])

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const chooseEmployee = (item) => {
    setEmployee(item)
    setSearchInput('')
    // Prefill the current grade from the employee master when it is a known grade.
    const known = GRADES.some((grade) => grade.title === item.grade)
    setForm((prev) => ({ ...prev, currentGrade: known ? item.grade : '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!employee) {
      toast.error('Please choose an employee')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/summaries/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, employeeId: employee.employeeId, periodeId: Number(form.periodeId) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to add to summary')

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
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Add to Summary Manually</h2>
            <p className="text-xs text-slate-500">
              Type PTC, no presentation, status Recommended. Skips eligibility, submission and presentation approval.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className={labelClass}>Employee</label>
            {employee ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-quaternary/40 bg-quaternary/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{employee.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {employee.employeeId}
                    {employee.department ? ` · ${employee.department}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmployee(null)}
                  className="shrink-0 text-xs font-medium text-secondary hover:text-primary"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <FiSearch
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search employee by name or ID"
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
                  />
                </div>
                {searchInput.trim() && (
                  <div className="mt-2 rounded-lg border border-slate-200">
                    {isSearching ? (
                      <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400">
                        <FiLoader className="animate-spin" size={13} /> Searching...
                      </p>
                    ) : results.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-slate-400">No matching employee</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {results.map((item) => (
                          <li key={item.employeeId}>
                            <button
                              type="button"
                              onClick={() => chooseEmployee(item)}
                              className="w-full px-3 py-2 text-left transition hover:bg-slate-50"
                            >
                              <p className="truncate text-sm font-medium text-slate-700">{item.name}</p>
                              <p className="truncate text-xs text-slate-400">
                                {item.employeeId}
                                {item.department ? ` · ${item.department}` : ''}
                                {item.grade ? ` · ${item.grade}` : ''}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className={labelClass}>Period</label>
            <select value={form.periodeId} onChange={setField('periodeId')} required className={inputClass}>
              {periodes.map((periode) => (
                <option key={periode.id} value={periode.id}>
                  {periode.name} · {getFiscalYearLabel(periode.fiscalYear)}
                  {periode.status === 'active' ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Current Grade</label>
              <select value={form.currentGrade} onChange={setField('currentGrade')} required className={inputClass}>
                <option value="">Choose grade</option>
                {GRADES.map((grade) => (
                  <option key={grade.title} value={grade.title}>
                    {grade.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Promote Grade</label>
              <select value={form.promoteGrade} onChange={setField('promoteGrade')} required className={inputClass}>
                <option value="">Choose grade</option>
                {GRADES.map((grade) => (
                  <option key={grade.title} value={grade.title}>
                    {grade.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Type', MANUAL_ENTRY.type],
              ['Presentation', MANUAL_ENTRY.presentation],
              ['Status', MANUAL_ENTRY.status],
            ].map(([label, value]) => (
              <div key={label}>
                <label className={labelClass}>{label}</label>
                <input value={value} readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
              </div>
            ))}
          </div>

          <div>
            <label className={labelClass}>Remark (optional)</label>
            <textarea
              value={form.remark}
              onChange={setField('remark')}
              rows={3}
              maxLength={500}
              placeholder="e.g. Reason for the manual entry"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !employee}
            className="w-full rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Adding...' : 'Add to Summary'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ManualSummaryModal
