import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiLoader, FiChevronLeft, FiChevronRight, FiSend, FiRefreshCw } from 'react-icons/fi'
import {
  RESULT_STATUS,
  PASSING_STATUSES,
  FAILING_STATUSES,
  COMMENT_REQUIRED_STATUSES,
  SCORE_OPTIONS,
  formatDateTime,
} from '../constants/assessment'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
// How often the other judges' assessments are refreshed while the modal is open.
const POLL_INTERVAL = 5000

const round2 = (value) => Math.round(value * 100) / 100

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

function StatusBadge({ status }) {
  const meta = RESULT_STATUS[status] || { label: status, style: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta.style}`}>{meta.label}</span>
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

// The other judges' results, refreshed by polling so a new assessment shows up right away.
function OtherAssessments({ assessments, pendingJudges }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Assessments by other judges</h3>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <FiRefreshCw size={11} /> Updates automatically
        </span>
      </div>

      {assessments.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No other judge has assessed this employee yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {assessments.map((item) => (
            <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{item.judgeName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Score {item.finalScore}</span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(item.assessedAt)}</p>
              {item.comment && <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600">{item.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {pendingJudges.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">Still waiting for: {pendingJudges.join(', ')}</p>
      )}
    </div>
  )
}

// Read-only view of an assessment that was already submitted.
function SubmittedAssessment({ assessment }) {
  const groups = assessment.scores.reduce((map, item) => {
    if (!map.has(item.category)) map.set(item.category, [])
    map.get(item.category).push(item)
    return map
  }, new Map())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">
          Your final score: <span className="font-semibold text-slate-800">{assessment.finalScore}</span>
        </span>
        <StatusBadge status={assessment.status} />
        <span className="text-xs text-slate-400">{formatDateTime(assessment.assessedAt)}</span>
      </div>
      {assessment.comment && (
        <p className="whitespace-pre-line rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
          {assessment.comment}
        </p>
      )}
      {[...groups.entries()].map(([category, items]) => (
        <div key={category}>
          <p className="text-xs font-semibold uppercase text-slate-400">{category}</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{item.area}</p>
                  <p className="text-sm text-slate-700">{item.question}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-quaternary/10 px-2.5 py-1 text-sm font-semibold text-quaternary">
                  {item.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AssessmentModal({ employeeId, onClose, onSubmitted }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0)
  const [values, setValues] = useState([])
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const url = `${API_URL}/judging/${employeeId}/assessment`

  const load = useCallback(async () => {
    const res = await fetch(url, { credentials: 'include' })
    const body = await res.json()
    if (!res.ok) throw new Error(body.message || 'Failed to load assessment')
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

    // Keep the other judges' results live; the form itself is never reset by a refresh.
    const interval = setInterval(async () => {
      try {
        const body = await load()
        if (!ignore) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  otherAssessments: body.otherAssessments,
                  pendingJudges: body.pendingJudges,
                  myAssessment: body.myAssessment,
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

  // Indicators per category, each with its index in the flat list of scores sent to the server.
  const sections = useMemo(() => {
    if (!data?.criteria) return []
    let index = 0
    return data.criteria.map((category) => ({
      name: category.categoryName,
      areas: category.competencyAreas.map((area) => ({
        name: area.areaName,
        indicators: area.indicators.map((indicator) => ({ ...indicator, index: index++ })),
      })),
    }))
  }, [data?.criteria])

  const indicatorCount = sections.reduce(
    (sum, section) => sum + section.areas.reduce((n, area) => n + area.indicators.length, 0),
    0
  )

  useEffect(() => {
    setValues(Array(indicatorCount).fill(null))
  }, [indicatorCount])

  const sectionComplete = (section) =>
    section.areas.every((area) => area.indicators.every((indicator) => values[indicator.index] != null))

  const isResultStep = step === sections.length
  const total = values.reduce((sum, value) => sum + (value || 0), 0)
  const assessmentScore = indicatorCount ? round2((total / (indicatorCount * 10)) * 100) : 0
  const toeic = data?.candidate?.toeic
  const finalScore = toeic == null ? assessmentScore : round2(assessmentScore * 0.8 + toeic * 0.2)
  const passScore = data?.passScore ?? 70
  const allowedStatuses = finalScore >= passScore ? PASSING_STATUSES : FAILING_STATUSES
  const commentRequired = COMMENT_REQUIRED_STATUSES.includes(status)

  const chooseStatus = (value) => {
    setStatus(value)
    // Recommended / Not Recommended use the status itself as the remark; the others need a written comment.
    setComment(COMMENT_REQUIRED_STATUSES.includes(value) ? '' : RESULT_STATUS[value].label)
  }

  const goToStep = (next) => {
    // The status options depend on the score, so clear a choice that may no longer fit.
    if (next === sections.length && status && !allowedStatuses.includes(status)) {
      setStatus('')
      setComment('')
    }
    setStep(next)
  }

  const setScore = (index, score) => {
    setValues((prev) => prev.map((value, i) => (i === index ? score : value)))
  }

  const handleSubmit = async () => {
    if (!status) {
      toast.error('Please choose a status')
      return
    }
    if (commentRequired && !comment.trim()) {
      toast.error('Please fill in the comment / task')
      return
    }
    if (!window.confirm('Submit this assessment? It cannot be changed afterwards.')) return

    setIsSubmitting(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scores: values, status, comment }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Failed to submit assessment')

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
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Presentation Assessment</h2>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
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
                {candidate.usesToeic && <InfoItem label="TOEIC" value={candidate.toeic ?? 'Not available'} />}
              </div>

              <OtherAssessments assessments={data.otherAssessments} pendingJudges={data.pendingJudges} />

              {data.myAssessment ? (
                <SubmittedAssessment assessment={data.myAssessment} />
              ) : !data.canAssess ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{data.reason}</p>
              ) : (
                <div>
                  <div className="flex gap-1.5">
                    {[...sections.map((section) => section.name), 'Result'].map((label, index) => (
                      <div
                        key={label}
                        className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${
                          index === step
                            ? 'bg-quaternary text-white'
                            : index < step
                              ? 'bg-quaternary/15 text-quaternary'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {index + 1}. {label}
                      </div>
                    ))}
                  </div>

                  {!isResultStep ? (
                    <div className="mt-4 space-y-3">
                      {sections[step].areas.map((area) =>
                        area.indicators.map((indicator) => (
                          <div key={indicator.index} className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs font-semibold uppercase text-slate-400">{area.name}</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{indicator.questionText}</p>
                            <p className="mt-0.5 text-xs italic text-slate-500">{indicator.translation}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-slate-400">Weak</span>
                              {SCORE_OPTIONS.map((score) => {
                                const isSelected = values[indicator.index] === score
                                return (
                                  <button
                                    key={score}
                                    type="button"
                                    onClick={() => setScore(indicator.index, score)}
                                    className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${
                                      isSelected
                                        ? 'border-quaternary bg-quaternary text-white'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    {score}
                                  </button>
                                )
                              })}
                              <span className="text-xs font-medium text-slate-400">Star</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 p-3">
                          <p className="text-xs text-slate-400">Assessment score</p>
                          <p className="text-xl font-bold text-slate-800">{assessmentScore}</p>
                        </div>
                        {toeic != null && (
                          <div className="rounded-lg border border-slate-200 p-3">
                            <p className="text-xs text-slate-400">TOEIC</p>
                            <p className="text-xl font-bold text-slate-800">{toeic}</p>
                          </div>
                        )}
                        <div className="rounded-lg border border-quaternary/40 bg-quaternary/5 p-3">
                          <p className="text-xs text-slate-500">Final score</p>
                          <p className="text-xl font-bold text-quaternary">{finalScore}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        {toeic != null
                          ? `Final score = assessment score × 0.8 + TOEIC × 0.2. `
                          : 'Final score = assessment score. '}
                        {finalScore >= passScore
                          ? `${finalScore} is ${passScore} or above.`
                          : `${finalScore} is below ${passScore}.`}
                      </p>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {allowedStatuses.map((value) => (
                            <label
                              key={value}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                status === value
                                  ? 'border-quaternary bg-quaternary/5 text-slate-800'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="assessment-status"
                                checked={status === value}
                                onChange={() => chooseStatus(value)}
                                className="accent-quaternary"
                              />
                              {RESULT_STATUS[value].label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {status && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            {commentRequired ? 'Comment / Task' : 'Remark'}{' '}
                            {commentRequired && <span className="text-red-500">*</span>}
                          </label>
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            readOnly={!commentRequired}
                            rows={4}
                            maxLength={1000}
                            placeholder={
                              status === 'recommended_with_task'
                                ? 'Write the task(s) the employee should complete'
                                : 'Explain the reason'
                            }
                            className={`${inputClass} ${commentRequired ? '' : 'bg-slate-50 text-slate-500'}`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {data?.canAssess && !data.myAssessment && sections.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0 || isSubmitting}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:invisible"
            >
              <FiChevronLeft size={15} /> Back
            </button>

            {!isResultStep ? (
              <div className="flex items-center gap-3">
                {!sectionComplete(sections[step]) && (
                  <span className="text-xs text-slate-400">Score every indicator to continue</span>
                )}
                <button
                  type="button"
                  onClick={() => goToStep(step + 1)}
                  disabled={!sectionComplete(sections[step])}
                  className="flex items-center gap-1 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next <FiChevronRight size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !status || (commentRequired && !comment.trim())}
                className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
                {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AssessmentModal
