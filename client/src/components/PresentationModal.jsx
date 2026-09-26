import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiInfo, FiLoader } from 'react-icons/fi'
import { GRADES } from '../constants/grades'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Only grades that require a project can be opened for presentation.
const PROJECT_GRADES = GRADES.filter((grade) => grade.project).map((grade) => grade.title)

const SECTIONS = [
  {
    label: 'Briefing',
    description: 'Employees are briefed on the project requirements.',
    start: 'briefingStart',
    end: 'briefingEnd',
  },
  {
    label: 'Submission',
    description: 'Employees upload their project files.',
    start: 'submissionStart',
    end: 'submissionEnd',
  },
  {
    label: 'Presentation',
    description: 'Employees present their project.',
    start: 'presentationStart',
    end: 'presentationEnd',
  },
]

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 disabled:bg-slate-50 disabled:text-slate-500'

const labelClass = 'mb-1.5 block text-xs font-medium text-slate-600'

// Today as "YYYY-MM-DD" in the browser's local time (what a <input type="date"> uses).
const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Number of days from start to end, both included.
const countDays = (start, end) => {
  if (!start || !end || end < start) return null
  const [y1, m1, d1] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1
}

const emptyForm = {
  grade: '',
  briefingStart: '',
  briefingEnd: '',
  submissionStart: '',
  submissionEnd: '',
  presentationStart: '',
  presentationEnd: '',
  isOpen: false,
}

function PresentationModal({ presentation, onClose, onSaved }) {
  const isEdit = Boolean(presentation)
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          grade: presentation.grade,
          briefingStart: presentation.briefingStart,
          briefingEnd: presentation.briefingEnd,
          submissionStart: presentation.submissionStart,
          submissionEnd: presentation.submissionEnd,
          presentationStart: presentation.presentationStart,
          presentationEnd: presentation.presentationEnd,
          isOpen: Boolean(presentation.isOpen),
        }
      : emptyForm
  )
  const [isSaving, setIsSaving] = useState(false)

  const today = todayString()
  // Once the submission end date has passed the presentation is closed automatically,
  // so it cannot be ticked open until the end date is extended.
  const isExpired = Boolean(form.submissionEnd) && form.submissionEnd < today

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  // Picking a start date later than the current end date moves the end date along with it.
  const setStartField = (start, end) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [start]: value, [end]: prev[end] && prev[end] < value ? value : prev[end] }))
  }

  const validate = () => {
    if (!form.grade) return 'Please choose a grade'

    for (const { label, start, end } of SECTIONS) {
      if (!form[start] || !form[end]) return `${label} start and end dates are required`
      // A start date that was already saved (edit) may stay as it is, even if it is in the past now.
      const unchanged = isEdit && presentation[start] === form[start]
      if (!unchanged && form[start] < today) return `${label} start date cannot be in the past`
      if (form[end] < form[start]) return `${label} end date cannot be before its start date`
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const problem = validate()
    if (problem) {
      toast.error(problem)
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/presentations${isEdit ? `/${presentation.id}` : ''}`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, isOpen: form.isOpen && !isExpired }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save presentation')
      }

      toast.success(data.message)
      onSaved()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="flex max-h-full w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isEdit ? 'Edit Presentation' : 'Add Presentation'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Set the schedule and open a grade for project submission.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div>
              <label className={labelClass}>Grade</label>
              <select
                value={form.grade}
                onChange={setField('grade')}
                disabled={isEdit}
                required
                className={inputClass}
              >
                <option value="">Select a grade</option>
                {PROJECT_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Employees being promoted to this grade. Only grades that require a project are listed.
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
              <FiInfo className="mt-0.5 shrink-0 text-slate-400" size={14} />
              <p>Start dates can be today or later. An end date cannot be before its start date.</p>
            </div>

            <div className="space-y-4">
              {SECTIONS.map(({ label, description, start, end }, index) => {
                const days = countDays(form[start], form[end])

                return (
                  <div key={label} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{label}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
                        </div>
                      </div>
                      {days && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          {days} {days === 1 ? 'day' : 'days'}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Start date</label>
                        <input
                          type="date"
                          value={form[start]}
                          min={today}
                          onChange={setStartField(start, end)}
                          required
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>End date</label>
                        <input
                          type="date"
                          value={form[end]}
                          min={form[start] || today}
                          onChange={setField(end)}
                          required
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <label
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                isExpired ? 'cursor-not-allowed border-slate-200 bg-slate-50' : 'cursor-pointer border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={form.isOpen && !isExpired}
                disabled={isExpired}
                onChange={(e) => setForm((prev) => ({ ...prev, isOpen: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-quaternary focus:ring-quaternary/30"
              />
              <span>
                <span className="block text-sm font-medium text-slate-700">Open for submission</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  When checked, employees promoted to this grade can submit. When unchecked, they cannot
                  submit yet. It closes automatically after the submission end date.
                </span>
                {isExpired && (
                  <span className="mt-2 block text-xs leading-relaxed text-amber-600">
                    The submission end date has passed, so submission is closed. Extend the end date to open
                    it again.
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-quaternary px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving && <FiLoader className="animate-spin" size={14} />}
              {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Presentation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PresentationModal
