import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiLoader } from 'react-icons/fi'
import SubmissionHistoryList from './SubmissionHistoryList'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const APPROVE_REASONS = [
  {
    value: 'Employee Merits',
    description:
      'A promotion is awarded because an employee demonstrates outstanding performance, significant contributions, or achievements that exceed expectations.',
  },
  {
    value: 'To Fill in Vacancies',
    description:
      'A promotion is made because there is a vacancy that must be filled immediately, for example due to retirement, resignation, or restructuring.',
  },
  {
    value: 'Organization Needs',
    description:
      "Promotions are carried out to support the organization's long-term strategy, for example business expansion, the formation of new divisions, or digital transformation.",
  },
  {
    value: 'Other',
    description:
      'For example a retention strategy: promotion as a way to retain talent so that it does not move to competitors.',
  },
]

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

// Submission approvals use a plain approve/reject choice with a required comment,
// prefilled with this text on approve and left empty on reject.
const SUBMISSION_APPROVE_COMMENT = 'Approve'

function PromotionDecisionModal({ request, decision: initialDecision, onClose, onDecided }) {
  const isSubmission = request.type === 'submission'
  const [decision, setDecision] = useState(initialDecision)
  const isApprove = decision === 'approve'
  const isHodStage = request.stage === 'hod'
  const [reason, setReason] = useState(APPROVE_REASONS[0].value)
  const [note, setNote] = useState('')
  const [comment, setComment] = useState(initialDecision === 'approve' ? SUBMISSION_APPROVE_COMMENT : '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedReason = APPROVE_REASONS.find((r) => r.value === reason)
  const isOther = reason === 'Other'

  // Submission history of this employee, so the approver sees earlier rejections before deciding.
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    if (!isSubmission) return undefined
    let ignore = false
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/promotions/${request.id}/submission-history`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to load submission history')
        if (!ignore) setHistory(data.history)
      } catch (error) {
        if (!ignore) setHistoryError(error.message || 'Failed to load submission history')
      }
    }
    loadHistory()
    return () => {
      ignore = true
    }
  }, [isSubmission, request.id])

  const handleDecisionChange = (value) => {
    setDecision(value)
    setComment(value === 'approve' ? SUBMISSION_APPROVE_COMMENT : '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    let remark = ''
    if (isSubmission) {
      remark = comment.trim()
      if (!remark) {
        toast.error(isApprove ? 'Please fill in the comment' : 'Please provide a reason for rejection')
        return
      }
    } else if (!isHodStage) {
      if (isApprove) {
        remark = isOther ? note.trim() : reason
        if (isOther && !remark) {
          toast.error('Please describe the reason')
          return
        }
      } else {
        remark = note.trim()
        if (!remark) {
          toast.error('Please provide a reason for rejection')
          return
        }
      }
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/promotions/${request.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision, remark }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to record decision')
      }

      toast.success(data.message)
      onDecided()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl ${
          isSubmission ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isSubmission ? 'Submission Decision' : isApprove ? 'Approve Request' : 'Reject Request'}
            </h2>
            <p className="text-xs text-slate-500">
              {request.employee?.employeeId} - {request.employee?.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {isSubmission ? (
            <>
              <div className="rounded-lg border border-slate-200 p-4">
                {history ? (
                  <SubmissionHistoryList
                    history={history}
                    submitterName={request.employee?.name || request.employeeId}
                    framed={false}
                  />
                ) : historyError ? (
                  <p className="text-xs text-red-500">{historyError}</p>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-slate-400">
                    <FiLoader className="animate-spin" size={13} /> Loading submission history...
                  </p>
                )}
              </div>

              {isHodStage && request.superiorRemark && (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  Superior&apos;s comment:{' '}
                  <span className="font-medium text-slate-700">{request.superiorRemark}</span>
                </p>
              )}

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
                        name="decision"
                        value={option.value}
                        checked={decision === option.value}
                        onChange={() => handleDecisionChange(option.value)}
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
                  maxLength={500}
                  required
                  placeholder={isApprove ? 'Comment' : 'Explain why this submission is being rejected'}
                  className={inputClass}
                />
              </div>
            </>
          ) : isHodStage ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Are you sure you want to {isApprove ? 'approve' : 'reject'} this promotion for{' '}
                <strong>{request.employee?.name}</strong>?
              </p>
              {request.superiorRemark && (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  Superior&apos;s reason:{' '}
                  <span className="font-medium text-slate-700">{request.superiorRemark}</span>
                </p>
              )}
            </div>
          ) : isApprove ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Reason for Approval</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
                  {APPROVE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value}
                    </option>
                  ))}
                </select>
              </div>

              {selectedReason && (
                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                  {selectedReason.description}
                </p>
              )}

              {isOther && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Please specify</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Describe the reason for this promotion"
                    className={inputClass}
                  />
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Reason for Rejection</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Explain why this request is being rejected"
                className={inputClass}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full rounded-lg py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
              isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isSubmitting ? 'Submitting...' : isApprove ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default PromotionDecisionModal
