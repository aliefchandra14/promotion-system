import nodemailer from 'nodemailer'

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

  const client = getTransporter()

  if (!client) {
    console.log('[email] SMTP is not configured yet (set SMTP_HOST/SMTP_USER/SMTP_PASS). Would have sent:', {
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

export const sendPeriodReminderEmail = async (periode, employees) => {
  const recipients = employees.map((emp) => emp.email).filter(Boolean)

  if (recipients.length === 0) {
    return { sent: 0, simulated: false }
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@promotionsystem.local',
    to: recipients.join(','),
    subject: `Reminder: promotion period "${periode.name}" is still open`,
    text: [
      `This is a reminder that the promotion period "${periode.name}" is currently active.`,
      `Please make sure to complete your eligibility check and submission before it closes.`,
      `Period: ${periode.startDate} - ${periode.endDate}`,
    ].join('\n'),
  }

  const client = getTransporter()

  if (!client) {
    console.log(
      '[email] SMTP is not configured yet (set SMTP_HOST/SMTP_USER/SMTP_PASS). Would have sent reminder:',
      { to: recipients.length, subject: mailOptions.subject }
    )
    return { sent: recipients.length, simulated: true }
  }

  await client.sendMail(mailOptions)
  console.log(`[email] Period reminder email sent to ${recipients.length} employee(s)`)
  return { sent: recipients.length, simulated: false }
}

export const isEmailConfigured = () => Boolean(getTransporter())

// Sends one email with its own To / CC. When SMTP is not configured yet nothing is sent
// and `simulated: true` is returned, so the caller can tell the admin.
export const deliverEmail = async ({ to, cc = [], subject, text, html }) => {
  const client = getTransporter()
  if (!client) return { simulated: true }

  const info = await client.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@promotionsystem.local',
    to,
    cc: cc.length > 0 ? cc.join(', ') : undefined,
    subject,
    text,
    html,
  })

  // A mail server may accept the CC addresses but refuse the main recipient. nodemailer still
  // resolves in that case, so check it explicitly: the person who must get the email did not.
  const rejected = (info.rejected || []).map((address) => String(address).toLowerCase())
  if (rejected.includes(String(to).toLowerCase())) {
    throw new Error(`The mail server rejected the address ${to}`)
  }

  return { simulated: false }
}
