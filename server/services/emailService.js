import nodemailer from 'nodemailer'
import { isDevMode } from './appMode.js'

let transporter = null

const getTransporter = () => {
  if (transporter) return transporter

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  return transporter
}

export const isEmailConfigured = () => Boolean(getTransporter())

/**
 * The mail client to send with, or `client: null` plus why nothing may be sent:
 * development mode (admin setting) always blocks email, otherwise SMTP must be configured.
 * Every email in the system goes through this, so dev mode blocks all of them.
 */
const resolveClient = async () => {
  if (await isDevMode()) {
    return { client: null, reason: 'development mode is on' }
  }
  const client = getTransporter()
  return { client, reason: client ? null : 'SMTP is not configured yet' }
}

// True when emails would really be delivered right now.
export const canSendEmail = async () => Boolean((await resolveClient()).client)

export const sendPeriodActivationEmail = async (periode, employees) => {
  const recipients = employees.map((emp) => emp.email).filter(Boolean)

  if (recipients.length === 0) {
    console.log('[email] No employee emails available, skipping period activation notification')
    return
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@promotionsystem.local',
    to: recipients.join(','),
    subject: `Promotion period "${periode.name}" is now active`,
    text: [
      `The promotion period "${periode.name}" is now active.`,
      `You can now log in to the Promotion System to start your eligibility and submission process.`,
      `Period: ${periode.startDate} - ${periode.endDate}`,
    ].join('\n'),
  }

  const { client, reason } = await resolveClient()

  if (!client) {
    console.log(`[email] Not sent (${reason}). Would have sent:`, {
      to: recipients.length,
      subject: mailOptions.subject,
    })
    return
  }

  try {
    await client.sendMail(mailOptions)
    console.log(`[email] Period activation email sent to ${recipients.length} employee(s)`)
  } catch (error) {
    console.error('[email] Failed to send period activation email:', error.message)
  }
}

// Sends one email with its own To / CC. When it may not be sent (development mode, or SMTP not
// configured yet) nothing is sent and `simulated: true` is returned, so the caller can tell the admin.
export const deliverEmail = async ({ to, cc = [], bcc = [], subject, text, html }) => {
  const { client, reason } = await resolveClient()
  if (!client) return { simulated: true, reason }

  const toList = Array.isArray(to) ? to : [to]
  const info = await client.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@promotionsystem.local',
    to: toList.join(', '),
    cc: cc.length > 0 ? cc.join(', ') : undefined,
    bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
    subject,
    text,
    html,
  })

  // A mail server may accept the CC addresses but refuse a main recipient. nodemailer still
  // resolves in that case, so check it explicitly: someone who must get the email did not.
  const rejected = (info.rejected || []).map((address) => String(address).toLowerCase())
  const refused = toList.find((address) => rejected.includes(String(address).toLowerCase()))
  if (refused) {
    throw new Error(`The mail server rejected the address ${refused}`)
  }

  return { simulated: false, reason: null }
}
