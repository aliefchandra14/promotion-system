import { useState } from 'react'
import { FiChevronDown, FiClock, FiFile, FiSend, FiCheck, FiX } from 'react-icons/fi'

const STATUS = {
  pending_superior: { label: 'Pending by Superior', style: 'bg-amber-50 text-amber-600' },
  pending_hod: { label: 'Pending by HOD', style: 'bg-amber-50 text-amber-600' },
  rejected_superior: { label: 'Rejected by Superior', style: 'bg-red-50 text-red-500' },
  rejected_hod: { label: 'Rejected by HOD', style: 'bg-red-50 text-red-500' },
  rejected_admin: { label: 'Rejected by Admin', style: 'bg-red-50 text-red-500' },
  complete: { label: 'Approved (Complete)', style: 'bg-green-50 text-green-600' },
}

const ROLE_LABEL = { employee: 'You', superior: 'Superior', hod: 'HOD', admin: 'Admin' }

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'

const describeEvent = ({ event, actorRole, actorName }, submitterName) => {
  if (event === 'submitted') {
    return submitterName ? `Submitted for approval by ${submitterName}` : 'Submitted for approval'
  }
  const who = `${ROLE_LABEL[actorRole] || actorRole}${actorName ? ` (${actorName})` : ''}`
  return `${event === 'approved' ? 'Approved' : 'Rejected'} by ${who}`
}

const EVENT_ICON = {
  submitted: { icon: FiSend, style: 'bg-slate-100 text-slate-500' },
  approved: { icon: FiCheck, style: 'bg-green-50 text-green-600' },
  rejected: { icon: FiX, style: 'bg-red-50 text-red-500' },
}

// `submitterName` is set when someone other than the employee views it (their superior/HOD).
function SubmissionHistoryList({ history, submitterName = null, framed = true }) {
  // Collapsed by default to keep the page short; any entry can be opened.
  const [openAttempts, setOpenAttempts] = useState(() => new Set())

  const toggle = (attempt) => {
    setOpenAttempts((prev) => {
      const next = new Set(prev)
      if (next.has(attempt)) next.delete(attempt)
      else next.add(attempt)
      return next
    })
  }

  return (
    <div className={framed ? 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm' : ''}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FiClock size={15} /> Submission history
      </h2>

      {history.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          {submitterName ? 'No submission history yet.' : 'You have not submitted your project yet.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {history.map((item) => {
            const isOpen = openAttempts.has(item.attempt)
            const status = STATUS[item.status] || { label: item.status, style: 'bg-slate-100 text-slate-500' }
            const lastEvent = item.events[item.events.length - 1]
            const rejectedBy = lastEvent?.event === 'rejected' ? lastEvent.actorName : null
            return (
              <li key={item.attempt} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggle(item.attempt)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">Submission #{item.attempt}</p>
                    <p className="text-xs text-slate-400">Submitted {formatDateTime(item.submittedAt)}</p>
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${status.style}`}>
                    {status.label}
                    {rejectedBy && ` (${rejectedBy})`}
                  </span>
                  <FiChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <ol className="space-y-3">
                      {item.events.map((event, index) => {
                        const { icon: Icon, style } = EVENT_ICON[event.event] || EVENT_ICON.submitted
                        return (
                          <li key={index} className="flex gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style}`}>
                              <Icon size={12} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-700">{describeEvent(event, submitterName)}</p>
                              <p className="text-xs text-slate-400">{formatDateTime(event.at)}</p>
                              {event.remark && (
                                <p
                                  className={`mt-1 rounded-lg p-2 text-xs ${
                                    event.event === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  {event.remark}
                                </p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>

                    {item.files.length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-xs font-medium text-slate-500">Files submitted</p>
                        <ul className="mt-1.5 space-y-1">
                          {item.files.map((name, fileIndex) => (
                            <li key={`${fileIndex}-${name}`} className="flex items-center gap-2 text-xs text-slate-600">
                              <FiFile size={12} className="shrink-0 text-slate-400" />
                              <span className="truncate">{name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default SubmissionHistoryList
