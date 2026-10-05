import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiLoader, FiChevronDown, FiDownload, FiFile } from 'react-icons/fi'
import { RESULT_STATUS, COMMENT_REQUIRED_STATUSES, formatDateTime } from '../constants/assessment'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }) {
  const meta = RESULT_STATUS[status] || { label: status, style: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta.style}`}>{meta.label}</span>
  )
}

// One judge's result; the indicator scores open on click.
function JudgeAssessment({ assessment }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <li className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700">{assessment.judgeName}</p>
          <p className="text-xs text-slate-400">{formatDateTime(assessment.assessedAt)}</p>
        </div>
        <span className="text-sm font-semibold text-slate-700">{assessment.finalScore}</span>
        <StatusBadge status={assessment.status} />
        <FiChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {assessment.comment && (
        <p className="whitespace-pre-line px-4 pb-3 text-xs text-slate-600">{assessment.comment}</p>
      )}
      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Assessment score {assessment.assessmentScore}
            {assessment.toeic != null ? ` · TOEIC ${assessment.toeic}` : ''} · Final {assessment.finalScore}
          </p>
          <ul className="mt-2 divide-y divide-slate-100">
            {assessment.scores.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">
                    {item.category} · {item.area}
                  </p>
                  <p className="text-xs text-slate-700">{item.question}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-700">{item.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

function FinalDecisionModal({ presentationId, employeeId, onClose, onSaved }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [busyFileId, setBusyFileId] = useState(null)

  const baseUrl = `${API_URL}/presentations/${presentationId}/candidates/${employeeId}`

  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}/assessments`, { credentials: 'include' })
        const body = await res.json()
        if (!res.ok) throw new Error(body.message || 'Failed to load assessments')
        if (ignore) return
        setData(body)
        if (body.decision) {
          setStatus(body.decision.status)
          setComment(body.decision.comment)
        }
      } catch (error) {
        if (!ignore) setLoadError(error.message || 'Something went wrong, please try again')
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [baseUrl])

  const commentRequired = COMMENT_REQUIRED_STATUSES.includes(status)
  const isLocked = Boolean(data?.decision?.taskSubmittedAt)
  const canDecide = data?.allAssessed && !isLocked

  const chooseStatus = (value) => {
    setStatus(value)
    // Recommended / Not Recommended use the status itself; the others need the summarized comment/task.
    setComment(COMMENT_REQUIRED_STATUSES.includes(value) ? '' : RESULT_STATUS[value].label)
  }

  const handleSave = async () => {
    if (!status) {
      toast.error('Please choose a status')
      return
    }
    if (commentRequired && !comment.trim()) {
      toast.error('Please fill in the comment / task')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`${baseUrl}/decision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, comment }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to save the final decision')

      toast.success(body.message)
      onSaved()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownload = async (file) => {
    setBusyFileId(file.id)
    try {
      const res = await fetch(`${API_URL}/task-submission/files/${file.id}/download`, { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Failed to download file')
      }
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyFileId(null)
    }
  }

  const candidate = data?.candidate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Final Decision</h2>
            {candidate && (
              <p className="text-xs text-slate-500">
                {candidate.employeeId} - {candidate.name} · {candidate.promoteGrade}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {loadError ? (
            <p className="py-10 text-center text-sm text-red-500">{loadError}</p>
          ) : !data ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <FiLoader className="animate-spin" size={16} /> Loading...
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <span className="text-slate-600">
                  Judges done:{' '}
                  <span className="font-semibold text-slate-800">
                    {data.assessments.length} / {data.judges.length}
                  </span>
                </span>
                {data.averageFinalScore != null && (
                  <span className="text-slate-600">
                    Average final score: <span className="font-semibold text-slate-800">{data.averageFinalScore}</span>
                  </span>
                )}
                {candidate.usesToeic && (
                  <span className="text-slate-600">
                    TOEIC: <span className="font-semibold text-slate-800">{candidate.toeic ?? '-'}</span>
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700">Judges&apos; assessments</h3>
                {data.assessments.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No judge has assessed this employee yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {data.assessments.map((assessment) => (
                      <JudgeAssessment key={assessment.id} assessment={assessment} />
                    ))}
                  </ul>
                )}
                {!data.allAssessed && (
                  <p className="mt-2 text-xs text-amber-600">
                    Waiting for: {data.judges.filter((judge) => !judge.assessed).map((judge) => judge.name).join(', ') || '-'}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-700">Final decision</h3>
                {!data.allAssessed ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    The final decision can be made once every judge has finished their assessment.
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {isLocked && (
                      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                        The employee submitted their task on {formatDateTime(data.decision.taskSubmittedAt)}, so the
                        decision can no longer be changed.
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.keys(RESULT_STATUS).map((value) => (
                        <label
                          key={value}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            status === value
                              ? 'border-quaternary bg-quaternary/5 text-slate-800'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          } ${canDecide ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                        >
                          <input
                            type="radio"
                            name="final-status"
                            checked={status === value}
                            onChange={() => chooseStatus(value)}
                            disabled={!canDecide}
                            className="accent-quaternary"
                          />
                          {RESULT_STATUS[value].label}
                        </label>
                      ))}
                    </div>

                    {status && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          {status === 'recommended_with_task' ? 'Task for the employee' : commentRequired ? 'Comment' : 'Remark'}{' '}
                          {commentRequired && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          readOnly={!commentRequired || !canDecide}
                          rows={5}
                          placeholder={
                            status === 'recommended_with_task'
                              ? "Summarize the judges' tasks; the employee will see this on their Task page"
                              : "Summarize the judges' comments"
                          }
                          className={`${inputClass} ${commentRequired && canDecide ? '' : 'bg-slate-50 text-slate-500'}`}
                        />
                      </div>
                    )}

                    {canDecide && status && (
                      <p className="text-xs text-slate-500">
                        {status === 'recommended_with_task'
                          ? 'The employee will see this task on their Task page and moves to the summary after the task is decided.'
                          : status === 'pending_6_month'
                            ? 'Saving moves the employee to the summary and makes them eligible for submission in the next period, without a new eligibility approval.'
                            : 'Saving moves the employee to the summary with this result.'}
                      </p>
                    )}

                    {canDecide && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !status || (commentRequired && !comment.trim())}
                        className="w-full rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? 'Saving...' : data.decision ? 'Update Final Decision' : 'Save Final Decision'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {(data.decision?.status === 'recommended_with_task' || data.decision?.taskSubmittedAt) && (
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700">Task submission</h3>
                  {!data.decision.taskSubmittedAt ? (
                    <p className="mt-2 text-xs text-slate-400">The employee has not submitted their task yet.</p>
                  ) : (
                    <>
                      <ul className="mt-2 divide-y divide-slate-100">
                        {data.taskFiles.map((file) => (
                          <li key={file.id} className="flex items-center gap-3 py-2">
                            <FiFile className="shrink-0 text-slate-400" size={16} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-slate-700">{file.originalName}</p>
                              <p className="text-xs text-slate-400">
                                {formatSize(file.size)} · {formatDateTime(file.uploadedAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              disabled={busyFileId === file.id}
                              title="Download"
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            >
                              <FiDownload size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <TaskReviewSection data={data} baseUrl={baseUrl} onSaved={onSaved} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Judges' reviews of the submitted task and admin's final approve/reject:
// approve -> Recommended, reject -> Not Recommended, then the employee moves to the summary.
function TaskReviewSection({ data, baseUrl, onSaved }) {
  const [decision, setDecision] = useState('approve')
  const [comment, setComment] = useState('Approve')
  const [isSaving, setIsSaving] = useState(false)

  const chooseDecision = (value) => {
    setDecision(value)
    setComment(value === 'approve' ? 'Approve' : '')
  }

  const handleSave = async () => {
    if (!comment.trim()) {
      toast.error(decision === 'reject' ? 'Please provide a reason for rejection' : 'Please fill in the comment')
      return
    }
    const result = decision === 'approve' ? 'Recommended' : 'Not Recommended'
    const action = decision === 'approve' ? 'Approve' : 'Reject'
    const question = `${action} this task? The result becomes "${result}" and the employee moves to the summary.`
    if (!window.confirm(`${question} This cannot be undone.`)) return

    setIsSaving(true)
    try {
      const res = await fetch(`${baseUrl}/task-decision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision, comment }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to save the task decision')

      toast.success(body.message)
      onSaved()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  const waitingFor = data.judges.filter((judge) => !judge.taskReviewed).map((judge) => judge.name)

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-400">Judges&apos; task reviews</h4>
      {data.taskReviews.length === 0 ? (
        <p className="text-xs text-slate-400">No judge has reviewed the task yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.taskReviews.map((review) => (
            <li key={review.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{review.judgeName}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    review.decision === 'approve' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                  }`}
                >
                  {review.decisionLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(review.reviewedAt)}</p>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{review.comment}</p>
            </li>
          ))}
        </ul>
      )}

      {data.taskDecision ? (
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <p className="text-slate-600">
            Final task decision:{' '}
            <span className="font-semibold text-slate-800">{data.taskDecision.decisionLabel}</span> on{' '}
            {formatDateTime(data.taskDecision.decidedAt)}
          </p>
          <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{data.taskDecision.comment}</p>
        </div>
      ) : !data.allTaskReviewed ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          The final task decision can be made once every judge has reviewed the task.
          {waitingFor.length > 0 && ` Waiting for: ${waitingFor.join(', ')}.`}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'approve', label: 'Approve → Recommended', active: 'border-green-500 bg-green-50 text-green-700' },
              { value: 'reject', label: 'Reject → Not Recommended', active: 'border-red-400 bg-red-50 text-red-600' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  decision === option.value ? option.active : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="task-final-decision"
                  checked={decision === option.value}
                  onChange={() => chooseDecision(option.value)}
                  className="accent-current"
                />
                {option.label}
              </label>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={decision === 'reject' ? 'Explain why the task is rejected' : 'Comment'}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !comment.trim()}
            className="w-full rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Task Decision'}
          </button>
        </div>
      )}
    </div>
  )
}

export default FinalDecisionModal
