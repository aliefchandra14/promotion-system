import { Op } from 'sequelize'
import { PromotionPresentation } from '../models/index.js'

// Today as "YYYY-MM-DD" in the server's local time, comparable with DATEONLY values.
export const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// The submission end date is inclusive: submission stays open through that day
// and is over from the next day.
export const isSubmissionEnded = (presentation) =>
  Boolean(presentation) && presentation.submissionEnd < todayString()

// Switches off every open presentation whose submission end date has passed.
// Cheap single UPDATE, called wherever the open/closed state is read, so a presentation
// closes by itself without anyone (or any scheduler) having to touch it.
export const closeExpiredPresentations = () =>
  PromotionPresentation.update(
    { isOpen: false },
    { where: { isOpen: true, submissionEnd: { [Op.lt]: todayString() } } }
  )
