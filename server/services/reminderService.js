import { Employee, EmployeePromotion, PresentationReminderLog } from '../models/index.js'
import { buildReminderEmail } from './reminderTemplates.js'
import { deliverEmail, isEmailConfigured, canSendEmail } from './emailService.js'
import { isDevMode } from './appMode.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SEND_CONCURRENCY = 5

export const cleanEmail = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null
}

// Emails of everyone who should be copied as "admin": active admin accounts, plus an optional
// ADMIN_EMAIL from the environment (useful while the admin account has no email of its own).
export const getAdminEmails = async () => {
  const admins = await Employee.findAll({
    where: { role: 'admin', isActive: true },
    attributes: ['email'],
    raw: true,
  })
  return [...admins.map((admin) => cleanEmail(admin.email)), cleanEmail(process.env.ADMIN_EMAIL)].filter(Boolean)
}

const unique = (emails) => {
  const seen = new Set()
  return emails.filter((email) => {
    const key = email.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Who gets a reminder for a grade, and with which To / CC.
 *
 * Recipients: employees of the presentation's period who are being promoted to this grade and
 * have been marked "eligible for submission".
 *  - To: the employee's own email; if they have none, their trainer's email.
 *  - CC: their superior, their trainer and the admin (never the same address as To, no duplicates).
 * Employees with no usable address at all are reported in `skipped` instead of being dropped silently.
 */
export const resolveReminderRecipients = async (presentation) => {
  const promotions = await EmployeePromotion.findAll({
    where: {
      periodeId: presentation.periodeId,
      promoteGrade: presentation.grade,
      adminDecision: 'eligible_for_submission',
    },
    attributes: ['employeeId'],
    raw: true,
  })

  const candidates = await Employee.findAll({
    where: { employeeId: promotions.map((p) => p.employeeId) },
    attributes: ['employeeId', 'name', 'email', 'trainer', 'superior', 'isActive'],
    order: [['employeeId', 'ASC']],
    raw: true,
  })

  const relatedIds = [...new Set(candidates.flatMap((c) => [c.trainer, c.superior]).filter(Boolean))]
  const related = relatedIds.length
    ? await Employee.findAll({ where: { employeeId: relatedIds }, attributes: ['employeeId', 'email'], raw: true })
    : []
  const emailById = new Map(related.map((person) => [person.employeeId, cleanEmail(person.email)]))
  const adminEmails = await getAdminEmails()

  const recipients = []
  const skipped = []

  for (const candidate of candidates) {
    if (!candidate.isActive) {
      skipped.push({ employeeId: candidate.employeeId, name: candidate.name, reason: 'Employee is inactive' })
      continue
    }

    const ownEmail = cleanEmail(candidate.email)
    const trainerEmail = emailById.get(candidate.trainer) || null
    const superiorEmail = emailById.get(candidate.superior) || null
    const to = ownEmail || trainerEmail

    if (!to) {
      skipped.push({
        employeeId: candidate.employeeId,
        name: candidate.name,
        reason: 'No email address, and the trainer has no email to fall back on',
      })
      continue
    }

    const cc = unique([superiorEmail, trainerEmail, ...adminEmails].filter(Boolean)).filter(
      (email) => email.toLowerCase() !== to.toLowerCase()
    )

    recipients.push({
      employee: { employeeId: candidate.employeeId, name: candidate.name },
      to,
      toIsTrainer: !ownEmail,
      cc,
    })
  }

  return { recipients, skipped }
}

// What the admin sees before confirming: who will be emailed, and a sample of the message.
export const previewReminder = async ({ type, presentation, periode }) => {
  const { recipients, skipped } = await resolveReminderRecipients(presentation)
  const sampleEmployee = recipients[0]?.employee || { employeeId: '000000', name: 'Employee Name' }
  const { subject, text } = buildReminderEmail(type, { employee: sampleEmployee, presentation, periode })

  return {
    smtpConfigured: isEmailConfigured(),
    devMode: await isDevMode(),
    recipients: recipients.map(({ employee, to, toIsTrainer, cc }) => ({
      employeeId: employee.employeeId,
      name: employee.name,
      to,
      toIsTrainer,
      cc,
    })),
    skipped,
    sample: { subject, text },
  }
}

// Sends one email per employee (each with its own To / CC), a few at a time.
export const sendReminder = async ({ type, presentation, periode, sentBy }) => {
  const { recipients, skipped } = await resolveReminderRecipients(presentation)
  const devMode = await isDevMode()
  const simulated = !(await canSendEmail())
  const failed = []
  let sent = 0

  for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
    const chunk = recipients.slice(i, i + SEND_CONCURRENCY)
    await Promise.all(
      chunk.map(async ({ employee, to, cc }) => {
        try {
          const email = buildReminderEmail(type, { employee, presentation, periode })
          await deliverEmail({ to, cc, ...email })
          sent += 1
        } catch (error) {
          failed.push({ employeeId: employee.employeeId, name: employee.name, reason: error.message })
        }
      })
    )
  }

  if (simulated) {
    const reason = devMode ? 'development mode is on' : 'SMTP is not configured yet'
    console.log(`[email] Not sent (${reason}). Would have sent ${sent} ${type} reminder(s) for ${presentation.grade}.`)
  } else {
    console.log(`[email] ${type} reminder for ${presentation.grade}: ${sent} sent, ${failed.length} failed`)
  }

  await PresentationReminderLog.create({
    presentationId: presentation.id,
    type,
    sentCount: sent,
    failedCount: failed.length,
    simulated,
    sentBy: sentBy || null,
  })

  return { sent, failed, skipped, simulated, devMode, total: recipients.length }
}
