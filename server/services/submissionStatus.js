// Submission status shown to admin, derived from the employee's "submission" PromotionRequest.
// `by` is the name of the approver the status refers to (superior or HOD).
export const SUBMISSION_STATUS = {
  not_started: 'Not Started',
  pending_superior: 'Pending by Superior',
  rejected_superior: 'Rejected by Superior',
  pending_hod: 'Pending by HOD',
  rejected_hod: 'Rejected by HOD',
  complete: 'Complete (Eligible for Presentation)',
}

export const getSubmissionStatus = (request, { superiorName = null, hodName = null } = {}) => {
  if (!request) return { key: 'not_started', by: null }

  switch (request.status) {
    case 'pending_superior':
      return { key: 'pending_superior', by: superiorName }
    case 'pending_hod':
      return { key: 'pending_hod', by: hodName }
    // Approved by the HOD means the submission is complete and the employee may present.
    case 'approved':
      return { key: 'complete', by: hodName }
    case 'rejected':
      return request.hodDecision === 'reject'
        ? { key: 'rejected_hod', by: hodName }
        : { key: 'rejected_superior', by: superiorName }
    default:
      return { key: 'not_started', by: null }
  }
}

export const PRESENTATION_STATUS = {
  not_eligible: 'Not Eligible Yet',
  waiting_judges: 'Waiting for Judges',
  in_assessment: 'Assessment in Progress',
  waiting_decision: 'Waiting Final Decision',
  decided: 'Final Decision Made',
}

export const getPresentationStatus = (submissionKey, judgeCount, assessedCount = 0, hasDecision = false) => {
  if (hasDecision) return 'decided'
  if (submissionKey !== 'complete') return 'not_eligible'
  if (judgeCount === 0) return 'waiting_judges'
  return assessedCount >= judgeCount ? 'waiting_decision' : 'in_assessment'
}
