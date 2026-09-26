import { SUBMISSION_GUIDELINES } from '../constants/submissionGuidelines.js'

// The three reminders an admin can send for a grade, and which schedule dates each one is about.
export const REMINDER_TYPES = {
  briefing: { label: 'Project Briefing', start: 'briefingStart', end: 'briefingEnd' },
  submission: { label: 'Project Submission', start: 'submissionStart', end: 'submissionEnd' },
  presentation: { label: 'Project Presentation', start: 'presentationStart', end: 'presentationEnd' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-10-05" -> "05 Oct 2026" (built from the parts, so no time zone can shift the day)
const formatDate = (value) => {
  const [year, month, day] = String(value).split('-').map(Number)
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`
}

const formatRange = (start, end) => (start === end ? formatDate(start) : `${formatDate(start)} - ${formatDate(end)}`)

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const getAppLink = () => {
  const base = (process.env.CLIENT_URL || '').replace(/\/$/, '')
  return base ? `${base}/promotionsystem/my-promotion` : null
}

// What the employee is asked to do for each reminder.
const buildIntroAndAction = (type, presentation) => {
  const { grade } = presentation

  if (type === 'briefing') {
    return {
      intro: `This is a friendly reminder about the project briefing for your promotion to ${grade}.`,
      action:
        'Please attend the briefing so that you understand the project requirements and how the submission works.',
    }
  }

  if (type === 'submission') {
    const formats = SUBMISSION_GUIDELINES.allowedExtensions.map((ext) => ext.toUpperCase()).join(', ')
    return {
      intro: `This is a friendly reminder about the project submission for your promotion to ${grade}.`,
      action:
        `Please upload your project files in the Promotion System (My Promotion > Submission Project) on or before ` +
        `${formatDate(presentation.submissionEnd)}. Upload guidelines: up to ${SUBMISSION_GUIDELINES.maxFiles} files, ` +
        `${SUBMISSION_GUIDELINES.maxFileSizeMB} MB per file, formats: ${formats}.`,
    }
  }

  return {
    intro: `This is a friendly reminder about the project presentation for your promotion to ${grade}.`,
    action:
      'Please prepare your presentation and be ready on the scheduled date. Contact your superior or trainer if you need any support.',
  }
}

/**
 * Builds the subject, plain-text and HTML body of one reminder email.
 * `employee` is the person being promoted, `presentation` the grade schedule, `periode` the active period.
 */
export const buildReminderEmail = (type, { employee, presentation, periode }) => {
  const config = REMINDER_TYPES[type]
  const { intro, action } = buildIntroAndAction(type, presentation)
  const link = getAppLink()

  const schedule = Object.entries(REMINDER_TYPES).map(([key, item]) => ({
    key,
    label: item.label.replace('Project ', ''),
    range: formatRange(presentation[item.start], presentation[item.end]),
    highlight: key === type,
  }))

  const subject = `Reminder: ${config.label} for ${presentation.grade} Promotion - ${periode.name}`

  const text = [
    `Dear ${employee.name},`,
    '',
    intro,
    '',
    `${config.label}: ${formatRange(presentation[config.start], presentation[config.end])}`,
    '',
    action,
    '',
    `Your promotion schedule (${presentation.grade}, ${periode.name}):`,
    ...schedule.map((item) => `  - ${item.label}: ${item.range}${item.highlight ? '  <- this reminder' : ''}`),
    ...(link ? ['', `You can follow your progress here: ${link}`] : []),
    '',
    'If you have any questions, please contact your superior or the HR administrator.',
    '',
    'Best regards,',
    'Promotion System',
    '(This is an automated message.)',
  ].join('\n')

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#253c6d;padding:20px 28px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">Promotion System</div>
          <div style="font-size:20px;font-weight:bold;margin-top:4px;">${escapeHtml(config.label)} Reminder</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;font-size:14px;line-height:1.6;">
          <p style="margin:0 0 14px;">Dear ${escapeHtml(employee.name)},</p>
          <p style="margin:0 0 14px;">${escapeHtml(intro)}</p>
          <div style="margin:0 0 14px;padding:14px 16px;background:#fff7ed;border-left:4px solid #f2842f;border-radius:6px;">
            <div style="font-size:12px;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(config.label)}</div>
            <div style="font-size:16px;font-weight:bold;">${escapeHtml(formatRange(presentation[config.start], presentation[config.end]))}</div>
          </div>
          <p style="margin:0 0 18px;">${escapeHtml(action)}</p>
          <div style="font-size:13px;font-weight:bold;margin:0 0 8px;">Your promotion schedule &middot; ${escapeHtml(presentation.grade)} &middot; ${escapeHtml(periode.name)}</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border:1px solid #e2e8f0;border-radius:8px;">
            ${schedule
              .map(
                (item) => `<tr style="background:${item.highlight ? '#fff7ed' : '#ffffff'};">
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;width:38%;">${escapeHtml(item.label)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:${item.highlight ? 'bold' : 'normal'};">${escapeHtml(item.range)}</td>
            </tr>`
              )
              .join('')}
          </table>
          ${
            link
              ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#f2842f;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:8px;">Open Promotion System</a></p>`
              : ''
          }
          <p style="margin:22px 0 0;">If you have any questions, please contact your superior or the HR administrator.</p>
          <p style="margin:18px 0 0;">Best regards,<br/>Promotion System</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 28px;background:#f8fafc;font-size:11px;color:#94a3b8;">This is an automated message. Your superior and trainer are copied on this email.</td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, text, html }
}
