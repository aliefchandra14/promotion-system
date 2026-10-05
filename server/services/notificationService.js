import { Employee, EmployeeJudge, EmployeePromotion } from '../models/index.js'
import { NOTIFICATION_TEMPLATES } from '../config/notificationTemplates.js'
import { getFiscalYearLabel } from '../constants/fiscalYear.js'
import { deliverEmail } from './emailService.js'
import { cleanEmail, getAdminEmails } from './reminderService.js'

const ROLES = ['employee', 'superior', 'hod', 'trainer', 'judges', 'admin', 'actor']
const SEND_CONCURRENCY = 5

// Replaces {{name}} with the value of `vars.name` (empty when unknown).
const render = (text, vars) =>
  String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => (vars[name] == null ? '' : String(vars[name])))

const unique = (emails) => {
  const seen = new Set()
  return emails.filter((email) => {
    const key = email.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Everything a notification about one employee may need: their related people's emails and the
// common placeholders.
const loadContext = async ({ employeeId, periode, actorId }) => {
  const [employee, promotion, judgeLinks, actor] = await Promise.all([
    Employee.findOne({
      where: { employeeId },
      attributes: ['employeeId', 'name', 'email', 'department'],
      include: [
        { model: Employee, as: 'superiorInfo', attributes: ['email'] },
        { model: Employee, as: 'hodInfo', attributes: ['email'] },
        { model: Employee, as: 'trainerInfo', attributes: ['email'] },
      ],
    }),
    periode ? EmployeePromotion.findOne({ where: { employeeId, periodeId: periode.id } }) : null,
    EmployeeJudge.findAll({
      where: { employeeId },
      include: [{ model: Employee, as: 'judge', attributes: ['email'] }],
    }),
    actorId ? Employee.findOne({ where: { employeeId: actorId }, attributes: ['email'] }) : null,
  ])

  return {
    emails: {
      employee: [cleanEmail(employee?.email)],
      superior: [cleanEmail(employee?.superiorInfo?.email)],
      hod: [cleanEmail(employee?.hodInfo?.email)],
      trainer: [cleanEmail(employee?.trainerInfo?.email)],
      judges: judgeLinks.map((link) => cleanEmail(link.judge?.email)),
      actor: [cleanEmail(actor?.email)],
    },
    vars: {
      employeeName: promotion?.name || employee?.name || employeeId,
      employeeId,
      department: promotion?.department || employee?.department || '',
      currentGrade: promotion?.currentGrade || '',
      promoteGrade: promotion?.promoteGrade || '',
      periodName: periode?.name || '',
      fiscalYear: periode ? getFiscalYearLabel(periode.fiscalYear) : '',
      periodStart: periode?.startDate || '',
      periodEnd: periode?.endDate || '',
      appUrl: process.env.CLIENT_URL || '',
    },
  }
}

// Turns a template's recipient list (roles and/or fixed addresses) into email addresses.
const resolveRecipients = async (list, emails, adminEmails) => {
  const result = []
  for (const entry of list || []) {
    const value = String(entry).trim()
    if (value === 'admin') result.push(...(await adminEmails()))
    else if (ROLES.includes(value)) result.push(...emails[value])
    else result.push(cleanEmail(value))
  }
  return unique(result.filter(Boolean))
}

/**
 * Sends notification `key` (see config/notificationTemplates.js) about one employee.
 * Never throws: a notification problem must not break the action that triggered it.
 * Returns { sent, simulated, skipped, reason }.
 */
export const sendNotification = async (key, { employeeId, periode = null, actorId = null, vars = {} }) => {
  const template = NOTIFICATION_TEMPLATES[key]
  if (!template?.enabled || !template.title || !template.body) {
    return { sent: false, skipped: true, reason: 'not enabled or template empty' }
  }

  try {
    const context = await loadContext({ employeeId, periode, actorId })
    let adminCache = null
    const adminEmails = async () => {
      adminCache = adminCache || (await getAdminEmails())
      return adminCache
    }

    const to = await resolveRecipients(template.to, context.emails, adminEmails)
    if (to.length === 0) {
      return { sent: false, skipped: true, reason: 'no "to" recipient with an email address' }
    }
    const toKeys = new Set(to.map((email) => email.toLowerCase()))
    const cc = (await resolveRecipients(template.cc, context.emails, adminEmails)).filter(
      (email) => !toKeys.has(email.toLowerCase())
    )
    const bcc = await resolveRecipients(template.bcc, context.emails, adminEmails)

    const allVars = { ...context.vars, ...vars }
    const result = await deliverEmail({
      to,
      cc,
      bcc,
      subject: render(template.title, allVars),
      text: render(template.body, allVars),
    })

    if (result.simulated) {
      console.log(`[notification] ${key} for ${employeeId} not sent (${result.reason})`)
    }
    return { sent: !result.simulated, simulated: result.simulated, skipped: false, reason: result.reason || null }
  } catch (error) {
    console.error(`[notification] ${key} for ${employeeId} failed:`, error.message)
    return { sent: false, skipped: false, reason: error.message }
  }
}

// Fire-and-forget version for request handlers: the response does not wait for the email.
export const notify = (key, options) => {
  sendNotification(key, options).catch(() => {})
}

// Sends one notification per employee, a few at a time, and counts the outcome.
export const sendNotificationToMany = async (key, employeeIds, options = {}) => {
  const counts = { sent: 0, simulated: 0, skipped: 0, failed: 0 }
  for (let i = 0; i < employeeIds.length; i += SEND_CONCURRENCY) {
    const results = await Promise.all(
      employeeIds.slice(i, i + SEND_CONCURRENCY).map((employeeId) => sendNotification(key, { ...options, employeeId }))
    )
    for (const result of results) {
      if (result.sent) counts.sent += 1
      else if (result.simulated) counts.simulated += 1
      else if (result.skipped) counts.skipped += 1
      else counts.failed += 1
    }
  }
  return counts
}
