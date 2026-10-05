import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiSearch, FiPlus, FiTrash2, FiLoader, FiRepeat } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const RESULT_LIMIT = 8

function CandidateJudgesModal({ presentationId, candidate, onClose, onChanged }) {
  const [judges, setJudges] = useState(candidate.judges)
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [replacing, setReplacing] = useState(null) // judge being swapped out during the task stage

  // Before the final decision judges are added/removed freely. While the task is being reviewed a judge
  // who has not reviewed it yet can only be swapped for another one. After that the list is fixed.
  const decision = candidate.decision
  const isTaskStage =
    Boolean(decision) &&
    (decision.status === 'recommended_with_task' || Boolean(decision.taskSubmittedAt)) &&
    !candidate.taskDecision
  const isLocked = Boolean(decision) && !isTaskStage
  const canSearch = !decision || (isTaskStage && replacing)

  const baseUrl = `${API_URL}/presentations/${presentationId}/candidates/${candidate.employeeId}/judges`

  // Active employees matching the search, minus the candidate and anyone already judging them.
  useEffect(() => {
    const term = searchInput.trim()
    if (!term) {
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
        if (!ignore) setResults(data.employees)
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
  }, [searchInput])

  const judgeIds = new Set(judges.map((judge) => judge.employeeId))
  const options = results.filter(
    (employee) => employee.employeeId !== candidate.employeeId && !judgeIds.has(employee.employeeId)
  )

  const handleAdd = async (employee) => {
    setBusyId(employee.employeeId)
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ judgeId: employee.employeeId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to add judge')

      toast.success(data.message)
      setJudges((prev) => [
        ...prev,
        { employeeId: employee.employeeId, name: employee.name, department: employee.department },
      ])
      onChanged()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  const handleReplace = async (employee) => {
    setBusyId(employee.employeeId)
    try {
      const res = await fetch(`${baseUrl}/${replacing.employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ judgeId: employee.employeeId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to change judge')

      toast.success(data.message)
      setJudges((prev) =>
        prev.map((item) =>
          item.employeeId === replacing.employeeId
            ? { employeeId: employee.employeeId, name: employee.name, department: employee.department }
            : item
        )
      )
      setReplacing(null)
      setSearchInput('')
      onChanged()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (judge) => {
    setBusyId(judge.employeeId)
    try {
      const res = await fetch(`${baseUrl}/${judge.employeeId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to remove judge')

      toast.success(data.message)
      setJudges((prev) => prev.filter((item) => item.employeeId !== judge.employeeId))
      onChanged()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Judges</h2>
            <p className="text-xs text-slate-500">
              {candidate.employeeId} - {candidate.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {isLocked && (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              The final decision has been made, so the judges can no longer be changed.
            </p>
          )}

          {isTaskStage && !replacing && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700">
              The task is being reviewed. A judge who has not reviewed it yet can be changed, for example when
              they are unavailable. The new judge sees the full assessment and approval history.
            </p>
          )}

          {canSearch && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-slate-600">
                  {replacing ? `Replace ${replacing.name} with` : 'Add judge'}
                </label>
                {replacing && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplacing(null)
                      setSearchInput('')
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
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
                  ) : options.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-slate-400">No matching employee</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {options.map((employee) => (
                        <li key={employee.employeeId} className="flex items-center gap-3 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-700">{employee.name}</p>
                            <p className="truncate text-xs text-slate-400">
                              {employee.employeeId}
                              {employee.department ? ` · ${employee.department}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => (replacing ? handleReplace(employee) : handleAdd(employee))}
                            disabled={busyId !== null}
                            className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {replacing ? <FiRepeat size={13} /> : <FiPlus size={13} />}
                            {replacing ? 'Select' : 'Add'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-800">Assigned judges</h3>
            <div className="mt-2 space-y-2">
              {judges.length === 0 ? (
                <p className="text-xs text-slate-400">No judges assigned yet</p>
              ) : (
                judges.map((judge) => (
                  <div
                    key={judge.employeeId}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                      replacing?.employeeId === judge.employeeId ? 'border-quaternary bg-quaternary/5' : 'border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-slate-700">
                        {judge.name} <span className="text-slate-400">({judge.employeeId})</span>
                      </p>
                      {isTaskStage && (
                        <p className={`text-xs ${judge.taskReviewed ? 'text-green-600' : 'text-amber-600'}`}>
                          {judge.taskReviewed ? 'Task reviewed' : 'Waiting for task review'}
                        </p>
                      )}
                    </div>

                    {isTaskStage ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplacing(judge)
                          setSearchInput('')
                        }}
                        disabled={busyId !== null || judge.taskReviewed}
                        title={judge.taskReviewed ? 'Already reviewed the task, cannot be changed' : 'Change judge'}
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-secondary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        <FiRepeat size={13} /> Change
                      </button>
                    ) : (
                      !isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemove(judge)}
                          disabled={busyId !== null || judge.assessed}
                          title={judge.assessed ? 'Already assessed, cannot be removed' : 'Remove judge'}
                          className="text-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandidateJudgesModal
