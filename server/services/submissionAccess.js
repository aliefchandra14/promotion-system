import { Periode, EmployeePromotion, PromotionPresentation, PromotionRequest } from '../models/index.js'
import { closeExpiredPresentations, isSubmissionEnded } from './presentationService.js'
import { isDevMode } from './appMode.js'

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

  const request = await PromotionRequest.findOne({
    where: { employeeId, periodeId: periode.id, type: 'submission' },
  })

  // Only one submission is allowed: once sent, files are locked while it is with the superior/HOD
  // and after it is approved. Only a rejection lets the employee change the file and submit again.
  const alreadySubmitted = alreadySubmittedReason(request)
  if (alreadySubmitted) {
    return { periode, promotion, presentation, request, canUpload: false, reason: alreadySubmitted }
  }

  // In development mode presentation dates and the open switch are not enforced.
  if (!presentation?.isOpen && !(await isDevMode())) {
    const reason = isSubmissionEnded(presentation)
      ? 'The submission period for your grade has ended.'
      : 'Submission is not open yet for your grade.'
    return { periode, promotion, presentation, request, canUpload: false, reason }
  }

  return { periode, promotion, presentation, request, canUpload: true, reason: null }
}

// Why the employee may not submit again, or null when they may (no submission yet, or rejected).
export const alreadySubmittedReason = (request) => {
  if (!request || request.status === 'rejected') return null
  if (request.status === 'approved') {
    return 'Your project has been approved, so it cannot be submitted again.'
  }
  return 'You have already submitted your project and it is waiting for approval. You can only submit again if it is rejected by your Superior, HOD or Admin.'
}
