import { Periode, PromotionPresentation, PresentationReminderLog } from '../models/index.js'
import { REMINDER_TYPES } from '../services/reminderTemplates.js'
import { previewReminder, sendReminder } from '../services/reminderService.js'

// Validates the request and loads what every reminder needs. Sends the error response itself
// and returns null when the reminder cannot go ahead.
const loadReminderContext = async (req, res) => {
  const { id, type } = req.params

  if (!REMINDER_TYPES[type]) {
    res.status(400).json({ message: 'Unknown reminder type' })
    return null
  }

  const presentation = await PromotionPresentation.findByPk(id)
  if (!presentation) {
    res.status(404).json({ message: 'Presentation not found' })
    return null
  }

  const periode = await Periode.findByPk(presentation.periodeId)
  if (!periode || periode.status !== 'active') {
    res.status(400).json({ message: 'Reminders can only be sent for the active period' })
    return null
  }

  return { type, presentation, periode }
}

export const getReminderPreview = async (req, res) => {
  try {
    const context = await loadReminderContext(req, res)
    if (!context) return

    const { type, presentation } = context
    const [preview, lastSent] = await Promise.all([
      previewReminder(context),
      PresentationReminderLog.findOne({
        where: { presentationId: presentation.id, type },
        order: [['createdAt', 'DESC']],
      }),
    ])

    return res.status(200).json({
      type,
      label: REMINDER_TYPES[type].label,
      grade: presentation.grade,
      ...preview,
      lastSent: lastSent
        ? { sentAt: lastSent.createdAt, sentCount: lastSent.sentCount, simulated: lastSent.simulated }
        : null,
    })
  } catch (error) {
    console.error('Reminder preview error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const sendPresentationReminder = async (req, res) => {
  try {
    const context = await loadReminderContext(req, res)
    if (!context) return

    const result = await sendReminder({ ...context, sentBy: req.user.employeeId })

    if (result.total === 0) {
      return res.status(400).json({
        message:
          result.skipped.length > 0
            ? 'Nobody could be emailed: none of the employees for this grade has an email address'
            : `There are no employees eligible for submission for ${context.presentation.grade} yet`,
      })
    }

    const label = REMINDER_TYPES[context.type].label.toLowerCase()
    const failedNote = result.failed.length > 0 ? ` ${result.failed.length} failed.` : ''
    const notSentReason = result.devMode
      ? 'Development mode is on'
      : 'The email server is not configured yet'
    const message = result.simulated
      ? `${result.sent} ${label} reminder(s) logged. ${notSentReason}, so nothing was actually sent.`
      : `${result.sent} ${label} reminder(s) sent.${failedNote}`

    return res.status(200).json({ message, ...result })
  } catch (error) {
    console.error('Send presentation reminder error:', error)
    return res.status(500).json({ message: 'Failed to send reminder email' })
  }
}
