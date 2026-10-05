import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiClipboard, FiEye, FiLoader } from 'react-icons/fi'
import AssessmentModal from '../components/AssessmentModal'
import TaskReviewModal, { TaskDecisionBadge } from '../components/TaskReviewModal'
import { RESULT_STATUS, formatDateTime } from '../constants/assessment'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const TABS = [
  { key: 'presentation', label: 'Presentation List' },
  { key: 'task', label: 'Task List' },
]

const LIST_TABS = {
  presentation: [
    { key: 'inProgress', label: 'In Progress' },
    { key: 'completed', label: 'Complete Presentation' },
  ],
  task: [
    { key: 'inProgress', label: 'In Progress' },
    { key: 'completed', label: 'Reviewed' },
  ],
}

const EMPTY_LISTS = { inProgress: [], completed: [] }

// Dates arrive as "YYYY-MM-DD"; build them locally so the shown day never shifts with the time zone.
const formatDate = (value) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatSchedule = (start, end) => (start ? `${formatDate(start)} – ${formatDate(end)}` : 'To be scheduled')

function JudgesPage() {
  const { refreshJudgingPending } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'task' ? 'task' : 'presentation'
  const listTab = searchParams.get('list') === 'completed' ? 'completed' : 'inProgress'

  const [lists, setLists] = useState({ presentation: EMPTY_LISTS, task: EMPTY_LISTS })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState(null) // null | { type: 'presentation' | 'task', employeeId }

  const fetchLists = useCallback(async () => {
    setLoadError('')
    try {
      const [presentationRes, taskRes] = await Promise.all([
        fetch(`${API_URL}/judging`, { credentials: 'include' }),
        fetch(`${API_URL}/judging/tasks`, { credentials: 'include' }),
      ])
      const [presentationData, taskData] = await Promise.all([presentationRes.json(), taskRes.json()])
      if (!presentationRes.ok) throw new Error(presentationData.message || 'Failed to load judging assignments')
      if (!taskRes.ok) throw new Error(taskData.message || 'Failed to load tasks')

      setLists({
        presentation: { inProgress: presentationData.inProgress, completed: presentationData.completed },
        task: { inProgress: taskData.inProgress, completed: taskData.completed },
      })
      refreshJudgingPending()
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [refreshJudgingPending])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const setParams = (patch) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    setSearchParams(next, { replace: true })
  }

  const closeModal = () => {
    setModal(null)
    fetchLists()
  }

  const isTaskTab = activeTab === 'task'
  const rows = lists[activeTab][listTab]
  const isCompleted = listTab === 'completed'
  const columnCount = 8

  const renderResultCell = (row) => {
    if (isTaskTab) {
      if (row.myReview) return <TaskDecisionBadge decision={row.myReview.decision} label={row.myReview.decisionLabel} />
      if (row.taskDecision) return <span className="text-xs text-slate-500">Decided by admin</span>
      return (
        <span className="text-slate-600">
          {row.judgesReviewed} / {row.judgesTotal}
        </span>
      )
    }
    const result = row.myAssessment && RESULT_STATUS[row.myAssessment.status]
    if (result) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{row.myAssessment.finalScore}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${result.style}`}>{result.label}</span>
        </div>
      )
    }
    return (
      <span className="text-slate-600">
        {row.judgesAssessed} / {row.judgesTotal}
      </span>
    )
  }

  const renderAction = (row) => {
    if (isCompleted) {
      return (
        <button
          type="button"
          onClick={() => setModal({ type: activeTab, employeeId: row.employeeId })}
          className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary"
        >
          <FiEye size={13} /> View
        </button>
      )
    }
    const disabled = !isTaskTab && !row.canAssess
    return (
      <button
        type="button"
        onClick={() => setModal({ type: activeTab, employeeId: row.employeeId })}
        disabled={disabled}
        title={disabled ? 'Project submission is not complete yet' : undefined}
        className="flex items-center gap-1 rounded-lg bg-quaternary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiClipboard size={13} /> {isTaskTab ? 'Review' : 'Assessment'}
      </button>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Judges</h1>
      <p className="mt-1 text-sm text-slate-500">Employees assigned for you to judge</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {TABS.map(({ key, label }) => {
          const pending = lists[key].inProgress.length
          return (
            <button
              key={key}
              type="button"
              onClick={() => setParams({ tab: key === 'presentation' ? null : key, list: null })}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                activeTab === key ? 'border-b-2 border-quaternary text-quaternary' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
              {pending > 0 && (
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold leading-none ${
                    activeTab === key ? 'bg-quaternary text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {pending}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex gap-2">
        {LIST_TABS[activeTab].map(({ key, label }) => {
          const isActive = listTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setParams({ list: key === 'inProgress' ? null : key })}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-primary text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
              <span
                className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold leading-none ${
                  isActive ? 'bg-white text-primary' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {lists[activeTab][key].length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-max min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">No</th>
              <th className="whitespace-nowrap px-4 py-3">Name</th>
              <th className="whitespace-nowrap px-4 py-3">Employee ID</th>
              <th className="whitespace-nowrap px-4 py-3">Department</th>
              <th className="whitespace-nowrap px-4 py-3">Promote Grade</th>
              <th className="whitespace-nowrap px-4 py-3">{isTaskTab ? 'Task Submitted' : 'Presentation'}</th>
              <th className="whitespace-nowrap px-4 py-3">
                {isCompleted ? (isTaskTab ? 'Your Review' : 'Your Result') : isTaskTab ? 'Judges Reviewed' : 'Judges Done'}
              </th>
              <th className="whitespace-nowrap px-4 py-3">Action</th>
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
                    onClick={fetchLists}
                    className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
                  >
                    Try Again
                  </button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  {isTaskTab
                    ? isCompleted
                      ? 'You have not reviewed any task yet'
                      : 'No task is waiting for your review'
                    : isCompleted
                      ? 'You have not assessed anyone yet'
                      : 'Nobody is waiting for your assessment'}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.employeeId} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{index + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.employeeId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.department || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.promoteGrade || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {isTaskTab
                      ? formatDateTime(row.taskSubmittedAt)
                      : formatSchedule(row.presentationStart, row.presentationEnd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{renderResultCell(row)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{renderAction(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'presentation' && (
        <AssessmentModal employeeId={modal.employeeId} onClose={closeModal} onSubmitted={closeModal} />
      )}
      {modal?.type === 'task' && (
        <TaskReviewModal employeeId={modal.employeeId} onClose={closeModal} onSubmitted={closeModal} />
      )}
    </div>
  )
}

export default JudgesPage
