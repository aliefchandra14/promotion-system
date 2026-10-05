import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiSend, FiLoader, FiAlertTriangle, FiInfo, FiUsers } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const formatSentAt = (value) =>
  new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function ReminderModal({ presentation, type, onClose, onSent }) {
  const [preview, setPreview] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [isSending, setIsSending] = useState(false)

  const endpoint = `${API_URL}/presentations/${presentation.id}/reminders/${type}`

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`${endpoint}/preview`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to load the reminder')
        if (!cancelled) setPreview(data)
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Something went wrong, please try again')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [endpoint])

  const handleSend = async () => {
    setIsSending(true)
    try {
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to send the reminder')

      toast.success(data.message, { duration: 6000 })
      if (data.failed?.length > 0) {
        toast.error(
          `Could not email: ${data.failed.map((item) => `${item.name} (${item.reason})`).join('; ')}`,
          { duration: 9000 }
        )
      }
      onSent()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSending(false)
    }
  }

  const label = preview?.label || `${type[0].toUpperCase()}${type.slice(1)}`
  const recipientCount = preview?.recipients.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{label} Reminder</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Email employees being promoted to <span className="font-medium text-slate-700">{presentation.grade}</span>
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!preview && !loadError && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <FiLoader className="animate-spin" size={16} />
              Loading recipients...
            </div>
          )}

          {loadError && <p className="py-10 text-center text-sm text-red-500">{loadError}</p>}

          {preview && (
            <>
              {preview.devMode ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                  <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
                  <p>
                    Development mode is on. Sending will only be logged on the server, nothing is actually
                    emailed.
                  </p>
                </div>
              ) : !preview.smtpConfigured && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                  <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
                  <p>
                    The email server is not configured yet. Sending will only be logged on the server, nothing
                    is actually emailed.
                  </p>
                </div>
              )}

              {preview.lastSent && (
                <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
                  <FiInfo className="mt-0.5 shrink-0 text-slate-400" size={14} />
                  <p>
                    Last sent on <span className="font-medium text-slate-700">{formatSentAt(preview.lastSent.sentAt)}</span>{' '}
                    to {preview.lastSent.sentCount} employee(s)
                    {preview.lastSent.simulated ? ' (logged only, not actually emailed)' : ''}.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                  <FiUsers size={13} /> {recipientCount} will be emailed
                </span>
                {preview.skipped.length > 0 && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                    {preview.skipped.length} skipped
                  </span>
                )}
              </div>

              <p className="text-xs leading-relaxed text-slate-400">
                Each employee gets their own email. <span className="font-medium text-slate-500">To:</span> the
                employee's email (their trainer's email if they have none).{' '}
                <span className="font-medium text-slate-500">CC:</span> their superior, their trainer and the admin.
              </p>

              {recipientCount === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  No employees are eligible for submission for {presentation.grade} yet.
                </p>
              ) : (
                <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Employee</th>
                        <th className="px-3 py-2 font-medium">To</th>
                        <th className="px-3 py-2 font-medium">CC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.recipients.map((recipient) => (
                        <tr key={recipient.employeeId}>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                            {recipient.name}
                            <span className="ml-1 text-slate-400">{recipient.employeeId}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {recipient.to}
                            {recipient.toIsTrainer && (
                              <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                trainer
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{recipient.cc.join(', ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.skipped.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-amber-600">Skipped (will not be emailed)</p>
                  <ul className="space-y-1 text-xs text-slate-500">
                    {preview.skipped.map((item) => (
                      <li key={item.employeeId}>
                        <span className="font-medium text-slate-600">{item.name}</span>{' '}
                        <span className="text-slate-400">{item.employeeId}</span> - {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-600">
                  Preview email
                </summary>
                <div className="border-t border-slate-200 px-4 py-4">
                  <p className="text-xs text-slate-400">Subject</p>
                  <p className="mb-3 text-sm font-medium text-slate-700">{preview.sample.subject}</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-600">
                    {preview.sample.text}
                  </pre>
                </div>
              </details>
            </>
          )}
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
            type="button"
            onClick={handleSend}
            disabled={!preview || recipientCount === 0 || isSending}
            className="flex items-center gap-2 rounded-lg bg-quaternary px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
            {isSending ? 'Sending...' : `Send to ${recipientCount} employee${recipientCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReminderModal
