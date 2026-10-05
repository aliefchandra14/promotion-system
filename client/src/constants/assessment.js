// Outcomes of a judge's assessment and of the admin's final decision (same four, see server
// services/assessmentService.js).
export const RESULT_STATUS = {
  recommended: { label: 'Recommended', style: 'bg-green-50 text-green-600' },
  recommended_with_task: { label: 'Recommended with Task', style: 'bg-sky-50 text-sky-600' },
  pending_6_month: { label: 'Pending 6 Month', style: 'bg-amber-50 text-amber-600' },
  not_recommended: { label: 'Not Recommended', style: 'bg-red-50 text-red-500' },
}

export const PASS_SCORE = 70
export const PASSING_STATUSES = ['recommended', 'recommended_with_task']
export const FAILING_STATUSES = ['not_recommended', 'pending_6_month']
export const COMMENT_REQUIRED_STATUSES = ['recommended_with_task', 'pending_6_month']

export const SCORE_OPTIONS = [5, 6, 7, 8, 9, 10]

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
