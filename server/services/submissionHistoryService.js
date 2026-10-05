import { SubmissionHistory } from '../models/index.js'

const latestAttempt = async (employeeId, periodeId, transaction) =>
  (await SubmissionHistory.max('attempt', { where: { employeeId, periodeId }, transaction })) || 0

// Starts a new attempt: the employee sent their project (again) for approval.
export const logSubmitted = async ({ employee, periodeId, fileNames, transaction }) => {
  const attempt = (await latestAttempt(employee.employeeId, periodeId, transaction)) + 1
  return SubmissionHistory.create(
    {
      employeeId: employee.employeeId,
      periodeId,
      attempt,
      event: 'submitted',
      actorRole: 'employee',
      actorId: employee.employeeId,
      actorName: employee.name,
      files: JSON.stringify(fileNames),
    },
    { transaction }
  )
}

// Records an approve/reject on the employee's current attempt.
export const logDecision = async ({ request, actorRole, actor, decision, remark, transaction }) => {
  const attempt = Math.max(await latestAttempt(request.employeeId, request.periodeId, transaction), 1)
  return SubmissionHistory.create(
    {
      employeeId: request.employeeId,
      periodeId: request.periodeId,
      attempt,
      event: decision === 'approve' ? 'approved' : 'rejected',
      actorRole,
      actorId: actor?.employeeId || null,
      actorName: actor?.name || null,
      remark: remark || null,
    },
    { transaction }
  )
}

const parseFiles = (value) => {
  try {
    const files = JSON.parse(value || '[]')
    return Array.isArray(files) ? files : []
  } catch {
    return []
  }
}

// Submissions made before history logging existed only live in the PromotionRequest row;
// rebuild what can be known from it so the employee still sees one entry.
const eventsFromRequest = (request) => {
  const events = [{ event: 'submitted', actorRole: 'employee', at: request.createdAt, remark: null, actorName: null }]
  if (request.superiorDecision) {
    events.push({
      event: request.superiorDecision === 'approve' ? 'approved' : 'rejected',
      actorRole: 'superior',
      at: request.superiorDecidedAt,
      remark: request.superiorRemark,
      actorName: null,
    })
  }
  if (request.hodDecision) {
    events.push({
      event: request.hodDecision === 'approve' ? 'approved' : 'rejected',
      actorRole: 'hod',
      at: request.hodDecidedAt,
      remark: request.hodRemark,
      actorName: null,
    })
  }
  return events
}

// The outcome of one attempt, from its last event.
const attemptStatus = (events) => {
  const last = events[events.length - 1]
  if (!last || last.event === 'submitted') return 'pending_superior'
  if (last.event === 'rejected') return last.actorRole === 'hod' ? 'rejected_hod' : `rejected_${last.actorRole}`
  // Approved: by the superior it moves on to the HOD; by the HOD (or admin) it is complete.
  return last.actorRole === 'superior' ? 'pending_hod' : 'complete'
}

/**
 * Every submission attempt of the employee in the period, newest first:
 * [{ attempt, submittedAt, files, status, events: [{ event, actorRole, actorName, remark, at }] }]
 */
export const getSubmissionHistory = async (employeeId, periodeId, request) => {
  const rows = await SubmissionHistory.findAll({
    where: { employeeId, periodeId },
    order: [
      ['attempt', 'ASC'],
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  })

  const attempts = new Map()
  for (const row of rows) {
    if (!attempts.has(row.attempt)) attempts.set(row.attempt, { attempt: row.attempt, files: [], events: [] })
    const item = attempts.get(row.attempt)
    if (row.event === 'submitted') item.files = parseFiles(row.files)
    item.events.push({
      event: row.event,
      actorRole: row.actorRole,
      actorName: row.actorName,
      remark: row.remark,
      at: row.createdAt,
    })
  }

  if (attempts.size === 0 && request) {
    attempts.set(1, { attempt: 1, files: [], events: eventsFromRequest(request) })
  }

  return [...attempts.values()]
    .map((item) => ({
      ...item,
      submittedAt: item.events.find((e) => e.event === 'submitted')?.at || item.events[0]?.at || null,
      status: attemptStatus(item.events),
    }))
    .reverse()
}
