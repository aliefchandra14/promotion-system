import { Periode, EmployeePromotion, PromotionPresentation } from '../models/index.js'
import { closeExpiredPresentations, isSubmissionEnded } from './presentationService.js'

// The presentation schedule/switch that applies to an employee: same period, and the grade
// they are being promoted to (the "Promote To" grade of their promotion record).
// Expired presentations are closed first, so `isOpen` is always up to date.
export const findPresentationFor = async (promotion, periodeId) => {
  await closeExpiredPresentations()
  if (!promotion?.promoteGrade) return null
  return PromotionPresentation.findOne({ where: { periodeId, grade: promotion.promoteGrade } })
}

/**
 * Can this employee upload their project right now?
 * Returns everything the caller needs, plus `reason` (why not) when `canUpload` is false.
 */
export const getSubmissionAccess = async (employeeId) => {
  const periode = await Periode.findOne({ where: { status: 'active' } })
  if (!periode) {
    return { periode: null, promotion: null, presentation: null, canUpload: false, reason: 'There is no active promotion period.' }
  }

  const promotion = await EmployeePromotion.findOne({ where: { employeeId, periodeId: periode.id } })
  const presentation = await findPresentationFor(promotion, periode.id)

  if (promotion?.adminDecision !== 'eligible_for_submission') {
    return { periode, promotion, presentation, canUpload: false, reason: 'You are not eligible for submission yet.' }
  }

  if (!presentation?.isOpen) {
    const reason = isSubmissionEnded(presentation)
      ? 'The submission period for your grade has ended.'
      : 'Submission is not open yet for your grade.'
    return { periode, promotion, presentation, canUpload: false, reason }
  }

  return { periode, promotion, presentation, canUpload: true, reason: null }
}
