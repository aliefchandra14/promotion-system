import {
  Employee,
  EmployeeJudge,
  EmployeePromotion,
  PresentationAssessment,
  PresentationDecision,
  PromotionRequest,
  TaskDecision,
  TaskReview,
} from '../models/index.js'
import { GRADES } from '../constants/grades.js'
import { JUDGE_ASSESSMENT } from '../constants/judgeAssessment.js'

export const MIN_SCORE = 5
export const MAX_SCORE = 10
export const PASS_SCORE = 70

// Same four outcomes for a judge's assessment and for the admin's final decision.
export const RESULT_STATUS = {
  recommended: 'Recommended',
  recommended_with_task: 'Recommended with Task',
  not_recommended: 'Not Recommended',
  pending_6_month: 'Pending 6 Month',
}
export const PASSING_STATUSES = ['recommended', 'recommended_with_task']
export const FAILING_STATUSES = ['not_recommended', 'pending_6_month']
// These need a comment/task written by the person deciding; the others use the status as the remark.
export const COMMENT_REQUIRED_STATUSES = ['recommended_with_task', 'pending_6_month']

const round2 = (value) => Math.round(value * 100) / 100

export const getCriteria = (grade) =>
  JUDGE_ASSESSMENT.find((item) => item.gradeLevel === grade)?.assessmentCategories || null

// TOEIC counts towards the final score from Senior Staff 1 upwards.
export const gradeUsesToeic = (grade) => Boolean(GRADES.find((item) => item.title === grade)?.toeic)

// Flattens the criteria into the indicators a judge scores, in display order.
const listIndicators = (criteria) =>
  criteria.flatMap((category) =>
    category.competencyAreas.flatMap((area) =>
      area.indicators.map((indicator) => ({
        category: category.categoryName,
        area: area.areaName,
        question: indicator.questionText,
      }))
    )
  )

/**
 * Scores the submitted values against the criteria. `values` is an array with one score (5-10)
 * per indicator in display order. Returns { error } when something is missing or out of range.
 * assessmentScore is the total scaled to 100; with TOEIC: final = assessment x 0.8 + TOEIC x 0.2.
 */
export const computeAssessment = (criteria, values, toeic) => {
  const indicators = listIndicators(criteria)
  if (!Array.isArray(values) || values.length !== indicators.length) {
    return { error: 'Please score every indicator' }
  }

  const items = []
  for (let i = 0; i < indicators.length; i += 1) {
    const score = Number(values[i])
    if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
      return { error: 'Please score every indicator' }
    }
    items.push({ ...indicators[i], score })
  }

  const total = items.reduce((sum, item) => sum + item.score, 0)
  const assessmentScore = round2((total / (indicators.length * MAX_SCORE)) * 100)
  const finalScore = toeic === null || toeic === undefined ? assessmentScore : round2(assessmentScore * 0.8 + toeic * 0.2)

  return { items, assessmentScore, finalScore }
}

// Checks the chosen status and comment. Judges must pick a status that matches the final score;
// pass `finalScore: null` to allow any status (admin's final decision).
// Returns { error } or { comment } (the remark to store).
export const resolveStatusAndComment = ({ status, comment, finalScore = null }) => {
  if (!RESULT_STATUS[status]) {
    return { error: 'Please choose a status' }
  }
  if (finalScore !== null) {
    const allowed = finalScore >= PASS_SCORE ? PASSING_STATUSES : FAILING_STATUSES
    if (!allowed.includes(status)) {
      return {
        error: `With a final score of ${finalScore}, choose ${allowed.map((key) => RESULT_STATUS[key]).join(' or ')}`,
      }
    }
  }

  const text = String(comment || '').trim()
  if (COMMENT_REQUIRED_STATUSES.includes(status)) {
    if (!text) return { error: 'Please fill in the comment / task' }
    return { comment: text }
  }
  return { comment: RESULT_STATUS[status] }
}

export const parseScores = (value) => {
  try {
    const items = JSON.parse(value || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export const toAssessmentDto = (assessment, { withScores = false } = {}) => ({
  id: assessment.id,
  judgeId: assessment.judgeId,
  judgeName: assessment.judgeName,
  assessmentScore: assessment.assessmentScore,
  toeic: assessment.toeic,
  finalScore: assessment.finalScore,
  status: assessment.status,
  statusLabel: RESULT_STATUS[assessment.status] || assessment.status,
  comment: assessment.comment,
  assessedAt: assessment.createdAt,
  ...(withScores ? { scores: parseScores(assessment.scores) } : {}),
})

export const toDecisionDto = (decision) =>
  decision
    ? {
        status: decision.status,
        statusLabel: RESULT_STATUS[decision.status] || decision.status,
        comment: decision.comment,
        decidedAt: decision.updatedAt,
        taskSubmittedAt: decision.taskSubmittedAt,
      }
    : null

/**
 * Everything about one presenting employee in a period: who they are, the TOEIC that counts,
 * whether their submission is complete, their judges, all assessments and the admin decision.
 * Returns null when they have no promotion record in the period.
 */
export const loadAssessmentSubject = async (employeeId, periodeId) => {
  const promotion = await EmployeePromotion.findOne({ where: { employeeId, periodeId } })
  if (!promotion) return null

  const [employee, submission, judgeLinks, assessments, decision, taskReviews, taskDecision] = await Promise.all([
    Employee.findOne({
      where: { employeeId },
      attributes: ['employeeId', 'name', 'department', 'superior'],
      include: [{ model: Employee, as: 'superiorInfo', attributes: ['name'] }],
    }),
    PromotionRequest.findOne({ where: { employeeId, periodeId, type: 'submission' } }),
    EmployeeJudge.findAll({
      where: { employeeId },
      include: [{ model: Employee, as: 'judge', attributes: ['employeeId', 'name'] }],
    }),
    PresentationAssessment.findAll({ where: { employeeId, periodeId }, order: [['createdAt', 'ASC']] }),
    PresentationDecision.findOne({ where: { employeeId, periodeId } }),
    TaskReview.findAll({ where: { employeeId, periodeId }, order: [['createdAt', 'ASC']] }),
    TaskDecision.findOne({ where: { employeeId, periodeId } }),
  ])

  const usesToeic = gradeUsesToeic(promotion.promoteGrade)
  const judges = judgeLinks.map((link) => ({
    employeeId: link.judgeId,
    name: link.judge?.name || link.judgeId,
  }))
  const assessedIds = new Set(assessments.map((a) => a.judgeId))
  const taskReviewedIds = new Set(taskReviews.map((r) => r.judgeId))

  return {
    candidate: {
      employeeId,
      name: promotion.name || employee?.name,
      department: promotion.department || employee?.department || null,
      superiorName: employee?.superiorInfo?.name || employee?.superior || null,
      promoteGrade: promotion.promoteGrade,
      usesToeic,
      // Only shown/used for grades that count TOEIC; admin enters the final TOEIC value.
      toeic: usesToeic ? promotion.toeic ?? null : null,
    },
    submissionComplete: submission?.status === 'approved',
    judges: judges.map((judge) => ({
      ...judge,
      assessed: assessedIds.has(judge.employeeId),
      taskReviewed: taskReviewedIds.has(judge.employeeId),
    })),
    assessments,
    decision,
    allAssessed: judges.length > 0 && judges.every((judge) => assessedIds.has(judge.employeeId)),
    // Task ("Recommended with Task"): submitted by the employee, reviewed by every judge, decided by admin.
    hasTask: Boolean(decision?.taskSubmittedAt) || decision?.status === 'recommended_with_task',
    taskSubmitted: Boolean(decision?.taskSubmittedAt),
    taskReviews,
    taskDecision,
    allTaskReviewed: judges.length > 0 && judges.every((judge) => taskReviewedIds.has(judge.employeeId)),
  }
}

export const TASK_DECISION = { approve: 'Approved', reject: 'Rejected' }
// Admin's task decision sets the final result.
export const TASK_RESULT_STATUS = { approve: 'recommended', reject: 'not_recommended' }

// Approve/reject with a comment: required on reject, defaults to Approve on approve.
// Returns { error } or { comment }.
export const resolveTaskDecision = ({ decision, comment }) => {
  if (!TASK_DECISION[decision]) return { error: 'Please choose approve or reject' }
  const text = String(comment || '').trim()
  if (decision === 'reject' && !text) return { error: 'Please provide a reason for rejection' }
  return { comment: text || 'Approve' }
}

export const toTaskReviewDto = (review) => ({
  id: review.id,
  judgeId: review.judgeId,
  judgeName: review.judgeName,
  decision: review.decision,
  decisionLabel: TASK_DECISION[review.decision] || review.decision,
  comment: review.comment,
  reviewedAt: review.createdAt,
})

export const toTaskDecisionDto = (taskDecision) =>
  taskDecision
    ? {
        decision: taskDecision.decision,
        decisionLabel: TASK_DECISION[taskDecision.decision] || taskDecision.decision,
        comment: taskDecision.comment,
        decidedAt: taskDecision.createdAt,
      }
    : null
