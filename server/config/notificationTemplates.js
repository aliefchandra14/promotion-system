/**
 * Email notification templates — edit this file to fill in or change the notifications.
 *
 * Every notification has:
 *   enabled  true to send it. A notification with an empty title or body is never sent.
 *   title    the email subject
 *   to / cc / bcc
 *            lists of recipients. Use a role, or write an email address directly:
 *              'employee'  the employee the notification is about
 *              'superior'  the employee's superior
 *              'hod'       the employee's HOD
 *              'trainer'   the employee's trainer
 *              'judges'    the employee's judges
 *              'admin'     every active admin account (+ ADMIN_EMAIL from the environment)
 *              'actor'     the person who did the action (the approver / judge / admin)
 *              'hr@company.com'  any fixed email address
 *            People without an email address are skipped; duplicates are removed.
 *   body     the email text. Placeholders like {{employeeName}} are replaced when sending.
 *
 * Placeholders available in every notification (title and body):
 *   {{employeeName}} {{employeeId}} {{department}} {{currentGrade}} {{promoteGrade}}
 *   {{periodName}} {{fiscalYear}} {{periodStart}} {{periodEnd}} {{appUrl}}
 * Extra placeholders per notification are listed above each one.
 *
 * Nothing is sent while development mode is on (Settings), whatever is set here.
 */
export const NOTIFICATION_TEMPLATES = {
  // 1. Admin presses "Send Reminder" on an active period. One email per active employee.
  periodReminder: {
    enabled: true,
    title: 'Reminder: promotion period "{{periodName}}" is still open',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: [
      'This is a reminder that the promotion period "{{periodName}}" is currently active.',
      'Please make sure to complete your eligibility check and submission before it closes.',
      'Period: {{periodStart}} - {{periodEnd}}',
    ].join('\n'),
  },

  // 2. Superior / HOD approves or rejects an eligibility request.
  //    Extra: {{decision}} (Approved / Rejected), {{stage}} (Superior / HOD), {{approverName}}, {{comment}}
  eligibilityApproval: {
    enabled: false,
    title: '',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 3. Admin marks an employee "Eligible for Submission" (Eligibility Monitoring).
  eligibleForSubmission: {
    enabled: false,
    title: '',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 4. Employee submits their project for approval (also when submitting again after a rejection).
  //    Extra: {{fileNames}}
  projectSubmitted: {
    enabled: false,
    title: '',
    to: ['superior'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 5. Superior / HOD approves or rejects the project submission.
  //    Extra: {{decision}} (Approved / Rejected), {{stage}} (Superior / HOD), {{approverName}}, {{comment}}
  submissionApproval: {
    enabled: false,
    title: '',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 6. Admin saves the final decision after the presentation.
  //    Extra: {{result}} (Recommended / Recommended with Task / Not Recommended / Pending 6 Month), {{comment}}
  presentationFinalDecision: {
    enabled: false,
    title: '',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 7. Employee submits their task (Recommended with Task).
  //    Extra: {{fileNames}}
  taskSubmitted: {
    enabled: false,
    title: '',
    to: ['judges'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 8. A judge approves or rejects the submitted task.
  //    Extra: {{decision}} (Approved / Rejected), {{judgeName}}, {{comment}}
  taskReview: {
    enabled: false,
    title: '',
    to: ['admin'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 9. Admin makes the final decision on the task (approve -> Recommended, reject -> Not Recommended).
  //    Extra: {{decision}} (Approved / Rejected), {{result}} (Recommended / Not Recommended), {{comment}}
  taskFinalDecision: {
    enabled: false,
    title: '',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: '',
  },

  // 10. Admin adds an employee to the summary manually (type PTC, status Recommended).
  //    Extra: {{remark}}
  manualSummaryPtc: {
    enabled: false,
    title: '',
    to: ['employee'],
    cc: [],
    bcc: [],
    body: '',
  },
}
