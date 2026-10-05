import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiLoader, FiDownload, FiFile, FiRefreshCw, FiSend, FiChevronDown } from 'react-icons/fi'
import { RESULT_STATUS, formatDateTime } from '../constants/assessment'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
// How often the other judges' reviews are refreshed while the modal is open.
const POLL_INTERVAL = 5000
const APPROVE_COMMENT = 'Approve'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskDecisionBadge({ decision, label }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        decision === 'approve' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
      }`}
    >
      {label}
    </span>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value ?? '-'}</p>
    </div>
  )
}

// The presentation assessments that led to the task (every judge, including ones replaced later).
function PresentationHistory({ assessments, result }) {
  const [isOpen, setIsOpen] = useState(false)
  const resultMeta = RESULT_STATUS[result.status]

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-700">Presentation assessment history</h3>
          <p className="text-xs text-slate-400">
            {assessments.length} assessment(s) · admin result {formatDateTime(result.decidedAt)}
          </p>
        </div>
        {resultMeta && (
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${resultMeta.style}`}>
            {resultMeta.label}
          </span>
        )}
        <FiChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul className="space-y-2 border-t border-slate-100 px-4 py-3">
          {assessments.map((item) => {
            const meta = RESULT_STATUS[item.status]
            return (
              <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700">{item.judgeName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Score {item.finalScore}</span>
                    {meta && (
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta.style}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(item.assessedAt)}</p>
                {item.comment && <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600">{item.comment}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TaskReviewModal({ employeeId, onClose, onSubmitted }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [decision, setDecision] = useState('approve')
  const [comment, setComment] = useState(APPROVE_COMMENT)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyFileId, setBusyFileId] = useState(null)

  const url = `${API_URL}/judging/${employeeId}/task`

  const load = useCallback(async () => {
    const res = await fetch(url, { credentials: 'include' })
    const body = await res.json()
    if (!res.ok) throw new Error(body.message || 'Failed to load task')
    return body
  }, [url])

  useEffect(() => {
    let ignore = false
    load()
      .then((body) => {
        if (!ignore) setData(body)
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message || 'Something went wrong, please try again')
      })

    // Keep the other judges' reviews live; the form itself is never reset by a refresh.
    const interval = setInterval(async () => {
      try {
        const body = await load()
        if (!ignore) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  otherReviews: body.otherReviews,
                  pendingJudges: body.pendingJudges,
                  taskDecision: body.taskDecision,
                }
              : body
          )
        }
      } catch {
        // Keep the last known list if a refresh fails.
      }
    }, POLL_INTERVAL)

    return () => {
      ignore = true
      clearInterval(interval)
    }
  }, [load])

  const chooseDecision = (value) => {
    setDecision(value)
    setComment(value === 'approve' ? APPROVE_COMMENT : '')
  }

  const handleDownload = async (file) => {
    setBusyFileId(file.id)
    try {
      const res = await fetch(`${API_URL}/task-submission/files/${file.id}/download`, { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Failed to download file')
      }
      const objectUrl = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setBusyFileId(null)
    }
  }

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast.error(decision === 'reject' ? 'Please provide a reason for rejection' : 'Please fill in the comment')
      return
    }
    if (!window.confirm('Submit this review? It cannot be changed afterwards.')) return

    setIsSubmitting(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision, comment }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to submit review')

      toast.success(body.message)
      onSubmitted()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const candidate = data?.candidate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Task Review</h2>
            {candidate && (
              <p className="text-xs text-slate-500">
                {candidate.employeeId} - {candidate.name}
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
              <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
                <InfoItem label="Name" value={candidate.name} />
                <InfoItem label="Employee ID" value={candidate.employeeId} />
                <InfoItem label="Department" value={candidate.department} />
                <InfoItem label="Superior" value={candidate.superiorName} />
                <InfoItem label="Promote Grade" value={candidate.promoteGrade} />
                <InfoItem label="Submitted" value={formatDateTime(data.task.submittedAt)} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700">Task</h3>
                <p className="mt-2 whitespace-pre-line rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  {data.task.text}
                </p>
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.task.files.map((file) => (
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
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FiDownload size={13} /> Download
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <PresentationHistory assessments={data.assessments} result={data.presentationResult} />

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">Task approval history</h3>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <FiRefreshCw size={11} /> Updates automatically
                  </span>
                </div>
                {data.otherReviews.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No other judge has reviewed this task yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {data.otherReviews.map((review) => (
                      <li key={review.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-700">{review.judgeName}</p>
                          <TaskDecisionBadge decision={review.decision} label={review.decisionLabel} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(review.reviewedAt)}</p>
                        <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600">{review.comment}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {data.pendingJudges.length > 0 && (
                  <p className="mt-3 text-xs text-slate-500">Still waiting for: {data.pendingJudges.join(', ')}</p>
                )}
              </div>

              {data.myReview ? (
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600">Your review:</span>
                    <TaskDecisionBadge decision={data.myReview.decision} label={data.myReview.decisionLabel} />
                    <span className="text-xs text-slate-400">{formatDateTime(data.myReview.reviewedAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{data.myReview.comment}</p>
                </div>
              ) : !data.canReview ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{data.reason}</p>
              ) : (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Decision</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'approve', label: 'Approve', active: 'border-green-500 bg-green-50 text-green-700' },
                        { value: 'reject', label: 'Reject', active: 'border-red-400 bg-red-50 text-red-600' },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            decision === option.value ? option.active : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="task-decision"
                            checked={decision === option.value}
                            onChange={() => chooseDecision(option.value)}
                            className="accent-current"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Comment <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder={decision === 'reject' ? 'Explain why this task is being rejected' : 'Comment'}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !comment.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
                    {isSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskReviewModal
