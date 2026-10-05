import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiSearch, FiArrowUp, FiArrowDown, FiUsers, FiAward } from 'react-icons/fi'
import Pagination from '../components/Pagination'
import CandidateJudgesModal from '../components/CandidateJudgesModal'
import FinalDecisionModal from '../components/FinalDecisionModal'
import { RESULT_STATUS } from '../constants/assessment'
import { useTableQueryState } from '../hooks/useTableQueryState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

const SUBMISSION_STATUS = {
  not_started: { label: 'Not Started', style: 'bg-slate-100 text-slate-500' },
  pending_superior: { label: 'Pending by Superior', style: 'bg-amber-50 text-amber-600' },
  rejected_superior: { label: 'Rejected by Superior', style: 'bg-red-50 text-red-500' },
  pending_hod: { label: 'Pending by HOD', style: 'bg-amber-50 text-amber-600' },
  rejected_hod: { label: 'Rejected by HOD', style: 'bg-red-50 text-red-500' },
  complete: { label: 'Complete (Eligible for Presentation)', style: 'bg-green-50 text-green-600' },
}

const PRESENTATION_STATUS = {
  not_eligible: { label: 'Not Eligible Yet', style: 'bg-slate-100 text-slate-500' },
  waiting_judges: { label: 'Waiting for Judges', style: 'bg-amber-50 text-amber-600' },
  in_assessment: { label: 'Assessment in Progress', style: 'bg-sky-50 text-sky-600' },
  waiting_decision: { label: 'Waiting Final Decision', style: 'bg-violet-50 text-violet-600' },
  decided: { label: 'Final Decision Made', style: 'bg-green-50 text-green-600' },
}

const columns = [
  { field: 'name', label: 'Name' },
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'department', label: 'Department' },
  { field: 'promoteGrade', label: 'Promote Grade' },
  { field: 'submissionStatus', label: 'Status Submission' },
  { field: 'presentationStatus', label: 'Status Presentation' },
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

function PresentationDetailPage() {
  const { id } = useParams()
  const [presentation, setPresentation] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [judgeCandidate, setJudgeCandidate] = useState(null)
  const [decisionCandidate, setDecisionCandidate] = useState(null)
  const latestRequest = useRef(0)

  const [table, updateTable] = useTableQueryState({
    search: '',
    submissionStatus: '',
    sortBy: 'name',
    sortOrder: 'ASC',
    page: 1,
  })
  const { search: debouncedSearch, submissionStatus, sortBy, sortOrder, page } = table

  const [searchInput, setSearchInput] = useState(debouncedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTable({ search: searchInput }, { resetPage: true })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const fetchCandidates = useCallback(async () => {
    const requestId = ++latestRequest.current
    setIsLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        submissionStatus,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/presentations/${id}/candidates?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load employees')
      }

      if (requestId !== latestRequest.current) return
      setPresentation(data.presentation)
      setCandidates(data.candidates)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      if (requestId === latestRequest.current) {
        setLoadError(error.message || 'Something went wrong, please try again')
      }
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false)
    }
  }, [id, debouncedSearch, submissionStatus, sortBy, sortOrder, page])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

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

  const handleJudgesChanged = () => {
    fetchCandidates()
  }

  const columnCount = columns.length + 2

  return (
    <div>
      <Link
        to="/presentations"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <FiArrowLeft size={15} /> Back to Presentations
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-bold text-slate-800">
          Presentation Detail{presentation ? ` – ${presentation.grade}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Employees eligible for submission to this grade</p>
      </div>

      {presentation && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Briefing', presentation.briefingStart, presentation.briefingEnd],
            ['Submission', presentation.submissionStart, presentation.submissionEnd],
            ['Presentation', presentation.presentationStart, presentation.presentationEnd],
          ].map(([label, start, end]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {formatDate(start)} – {formatDate(end)}
              </p>
            </div>
          ))}
        </div>
      )}

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
            placeholder="Search by name, ID or department"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>

        <select
          value={submissionStatus}
          onChange={(e) => updateTable({ submissionStatus: e.target.value }, { resetPage: true })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Submission Status</option>
          {Object.entries(SUBMISSION_STATUS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-max min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">No</th>
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
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center">
                  <p className="text-sm text-red-500">{loadError}</p>
                  <button
                    type="button"
                    onClick={fetchCandidates}
                    className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
                  >
                    Try Again
                  </button>
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  No employee eligible for submission to this grade yet
                </td>
              </tr>
            ) : (
              candidates.map((row, index) => {
                const submission = SUBMISSION_STATUS[row.submissionStatus.key]
                const presentationStatus = PRESENTATION_STATUS[row.presentationStatus]
                const isComplete = row.submissionStatus.key === 'complete'
                return (
                  <tr key={row.employeeId} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{(page - 1) * LIMIT + index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.employeeId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.department || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.promoteGrade || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        title={row.submissionRemark ? `Reason: ${row.submissionRemark}` : undefined}
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${submission.style}`}
                      >
                        {submission.label}
                        {row.submissionStatus.by && !isComplete && ` (${row.submissionStatus.by})`}
                      </span>
                      {isComplete && row.submissionStatus.by && (
                        <p className="mt-1 text-xs text-slate-500">Approved by HOD ({row.submissionStatus.by})</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${presentationStatus.style}`}
                      >
                        {row.decision
                          ? RESULT_STATUS[row.decision.status]?.label || presentationStatus.label
                          : presentationStatus.label}
                        {row.presentationStatus === 'in_assessment' && ` (${row.assessedCount}/${row.judges.length})`}
                      </span>
                      {row.judges.length > 0 && (
                        <p
                          className="mt-1 max-w-56 truncate text-xs text-slate-500"
                          title={row.judges.map((judge) => `${judge.name}${judge.assessed ? ' ✓' : ''}`).join(', ')}
                        >
                          {row.judges.map((judge) => `${judge.name}${judge.assessed ? ' ✓' : ''}`).join(', ')}
                        </p>
                      )}
                      {(row.decision?.status === 'recommended_with_task' || row.decision?.taskSubmittedAt) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {row.taskDecision
                            ? `Task ${row.taskDecision.decision === 'approve' ? 'approved' : 'rejected'} · in summary`
                            : row.decision.taskSubmittedAt
                              ? `Task review (${row.taskReviewedCount}/${row.judges.length})`
                              : 'Task not submitted yet'}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setJudgeCandidate(row)}
                          disabled={!isComplete}
                          title={isComplete ? 'Choose judges' : 'Available once the submission is complete'}
                          className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <FiUsers size={13} /> Judges
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionCandidate(row)}
                          disabled={row.assessedCount === 0 && !row.decision}
                          title={
                            row.assessedCount === 0 && !row.decision
                              ? 'Available once a judge has assessed this employee'
                              : 'Assessments and final decision'
                          }
                          className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <FiAward size={13} /> Final Decision
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
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

      {decisionCandidate && (
        <FinalDecisionModal
          presentationId={id}
          employeeId={decisionCandidate.employeeId}
          onClose={() => setDecisionCandidate(null)}
          onSaved={() => {
            setDecisionCandidate(null)
            fetchCandidates()
          }}
        />
      )}

      {judgeCandidate && (
        <CandidateJudgesModal
          presentationId={id}
          candidate={judgeCandidate}
          onClose={() => setJudgeCandidate(null)}
          onChanged={handleJudgesChanged}
        />
      )}
    </div>
  )
}

export default PresentationDetailPage
