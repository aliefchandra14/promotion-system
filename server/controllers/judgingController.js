import { Op } from 'sequelize'
import {
  Employee,
  EmployeeJudge,
  EmployeePromotion,
  Periode,
  PresentationAssessment,
  PresentationDecision,
  PromotionPresentation,
  PromotionRequest,
  TaskDecision,
  TaskReview,
  TaskSubmissionFile,
} from '../models/index.js'
import {
  RESULT_STATUS,
  PASS_SCORE,
  computeAssessment,
  getCriteria,
  loadAssessmentSubject,
  resolveStatusAndComment,
  toAssessmentDto,
  resolveTaskDecision,
  toTaskReviewDto,
  toTaskDecisionDto,
} from '../services/assessmentService.js'
import { notify } from '../services/notificationService.js'

// Employees the logged-in judge is assigned to in the active period, split into the ones they
// still have to assess (inProgress) and the ones they already assessed (completed).
export const getMyJudgingList = async (req, res) => {
  try {
    const me = req.user.employeeId
    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res.status(200).json({ periode: null, inProgress: [], completed: [] })
    }

    const links = await EmployeeJudge.findAll({ where: { judgeId: me }, attributes: ['employeeId'], raw: true })
    const employeeIds = links.map((link) => link.employeeId)
    if (employeeIds.length === 0) {
      return res.status(200).json({ periode, inProgress: [], completed: [] })
    }

    const [promotions, submissions, myAssessments, allLinks, allAssessments, presentations, decisions] =
      await Promise.all([
        EmployeePromotion.findAll({ where: { employeeId: employeeIds, periodeId: periode.id } }),
        PromotionRequest.findAll({
          where: { employeeId: employeeIds, periodeId: periode.id, type: 'submission' },
          attributes: ['employeeId', 'status'],
          raw: true,
        }),
        PresentationAssessment.findAll({ where: { employeeId: employeeIds, periodeId: periode.id, judgeId: me } }),
        EmployeeJudge.findAll({ where: { employeeId: employeeIds }, attributes: ['employeeId'], raw: true }),
        PresentationAssessment.findAll({
          where: { employeeId: employeeIds, periodeId: periode.id },
          attributes: ['employeeId'],
          raw: true,
        }),
        PromotionPresentation.findAll({ where: { periodeId: periode.id } }),
        PresentationDecision.findAll({
          where: { employeeId: employeeIds, periodeId: periode.id },
          attributes: ['employeeId'],
          raw: true,
        }),
      ])

    const submissionById = new Map(submissions.map((s) => [s.employeeId, s.status]))
    const mineById = new Map(myAssessments.map((a) => [a.employeeId, a]))
    const presentationByGrade = new Map(presentations.map((p) => [p.grade, p]))
    const decidedIds = new Set(decisions.map((d) => d.employeeId))
    const countBy = (rows) =>
      rows.reduce((map, row) => map.set(row.employeeId, (map.get(row.employeeId) || 0) + 1), new Map())
    const judgeCount = countBy(allLinks)
    const assessedCount = countBy(allAssessments)

    const rows = promotions
      .map((promotion) => {
        const mine = mineById.get(promotion.employeeId)
        const presentation = presentationByGrade.get(promotion.promoteGrade)
        return {
          employeeId: promotion.employeeId,
          name: promotion.name,
          department: promotion.department,
          promoteGrade: promotion.promoteGrade,
          presentationStart: presentation?.presentationStart || null,
          presentationEnd: presentation?.presentationEnd || null,
          canAssess: submissionById.get(promotion.employeeId) === 'approved',
          judgesTotal: judgeCount.get(promotion.employeeId) || 0,
          judgesAssessed: assessedCount.get(promotion.employeeId) || 0,
          myAssessment: mine ? toAssessmentDto(mine) : null,
          // A judge assigned after admin's decision (replacement) has nothing left to assess here.
          decided: decidedIds.has(promotion.employeeId),
        }
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    return res.status(200).json({
      periode,
      inProgress: rows.filter((row) => !row.myAssessment && !row.decided),
      completed: rows.filter((row) => row.myAssessment || row.decided),
    })
  } catch (error) {
    console.error('Get judging list error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Sidebar badge: employees in the active period the logged-in judge can assess but has not yet
// (submission complete, no assessment from them, no final decision).
export const getJudgingPendingCount = async (req, res) => {
  try {
    const me = req.user.employeeId
    const periode = await Periode.findOne({ where: { status: 'active' }, attributes: ['id'] })
    if (!periode) return res.status(200).json({ pending: 0, presentations: 0, tasks: 0 })

    const links = await EmployeeJudge.findAll({ where: { judgeId: me }, attributes: ['employeeId'], raw: true })
    const employeeIds = links.map((link) => link.employeeId)
    if (employeeIds.length === 0) return res.status(200).json({ pending: 0, presentations: 0, tasks: 0 })

    const [ready, assessed, decided] = await Promise.all([
      PromotionRequest.findAll({
        where: { employeeId: employeeIds, periodeId: periode.id, type: 'submission', status: 'approved' },
        attributes: ['employeeId'],
        raw: true,
      }),
      PresentationAssessment.findAll({
        where: { employeeId: employeeIds, periodeId: periode.id, judgeId: me },
        attributes: ['employeeId'],
        raw: true,
      }),
      PresentationDecision.findAll({
        where: { employeeId: employeeIds, periodeId: periode.id },
        attributes: ['employeeId'],
        raw: true,
      }),
    ])

    const done = new Set([...assessed, ...decided].map((row) => row.employeeId))
    const presentations = new Set(ready.map((row) => row.employeeId).filter((id) => !done.has(id))).size

    // Submitted tasks this judge has not reviewed yet (and admin has not decided).
    const [submittedTasks, myTaskReviews, taskDecisions] = await Promise.all([
      PresentationDecision.findAll({
        where: { employeeId: employeeIds, periodeId: periode.id, taskSubmittedAt: { [Op.ne]: null } },
        attributes: ['employeeId'],
        raw: true,
      }),
      TaskReview.findAll({
        where: { employeeId: employeeIds, periodeId: periode.id, judgeId: me },
        attributes: ['employeeId'],
        raw: true,
      }),
      TaskDecision.findAll({
        where: { employeeId: employeeIds, periodeId: periode.id },
        attributes: ['employeeId'],
        raw: true,
      }),
    ])
    const taskDone = new Set([...myTaskReviews, ...taskDecisions].map((row) => row.employeeId))
    const tasks = submittedTasks.filter((row) => !taskDone.has(row.employeeId)).length

    return res.status(200).json({ pending: presentations + tasks, presentations, tasks })
  } catch (error) {
    console.error('Get judging pending count error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Loads the subject and checks the logged-in user is one of their judges.
// Sends the error response itself and returns null when not allowed.
const loadForJudge = async (req, res) => {
  const periode = await Periode.findOne({ where: { status: 'active' } })
  if (!periode) {
    res.status(400).json({ message: 'There is no active promotion period' })
    return null
  }

  const link = await EmployeeJudge.findOne({
    where: { employeeId: req.params.employeeId, judgeId: req.user.employeeId },
  })
  if (!link) {
    res.status(403).json({ message: 'You are not a judge for this employee' })
    return null
  }

  const subject = await loadAssessmentSubject(req.params.employeeId, periode.id)
  if (!subject) {
    res.status(404).json({ message: 'This employee has no promotion in the active period' })
    return null
  }
  return { periode, subject }
}

// Data for the assessment modal. Polled while the modal is open, so assessments made by
// the other judges show up without reloading.
export const getAssessmentForm = async (req, res) => {
  try {
    const context = await loadForJudge(req, res)
    if (!context) return
    const { subject } = context
    const me = req.user.employeeId

    const mine = subject.assessments.find((a) => a.judgeId === me)
    const criteria = getCriteria(subject.candidate.promoteGrade)

    let reason = null
    if (!subject.submissionComplete) reason = 'The project submission of this employee is not complete yet.'
    else if (!criteria) reason = `There are no assessment criteria for ${subject.candidate.promoteGrade}.`
    else if (mine) reason = 'You have already assessed this employee.'
    else if (subject.decision) reason = 'Admin has already made the final decision.'

    return res.status(200).json({
      candidate: subject.candidate,
      criteria,
      passScore: PASS_SCORE,
      statuses: RESULT_STATUS,
      canAssess: !reason,
      reason,
      myAssessment: mine ? toAssessmentDto(mine, { withScores: true }) : null,
      // Other judges: who has assessed, and who is still to do it.
      otherAssessments: subject.assessments.filter((a) => a.judgeId !== me).map((a) => toAssessmentDto(a)),
      pendingJudges: subject.judges.filter((j) => !j.assessed && j.employeeId !== me).map((j) => j.name),
    })
  } catch (error) {
    console.error('Get assessment form error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const submitAssessment = async (req, res) => {
  try {
    const context = await loadForJudge(req, res)
    if (!context) return
    const { periode, subject } = context
    const me = req.user.employeeId

    if (!subject.submissionComplete) {
      return res.status(400).json({ message: 'The project submission of this employee is not complete yet' })
    }
    if (subject.decision) {
      return res.status(400).json({ message: 'Admin has already made the final decision' })
    }
    if (subject.assessments.some((a) => a.judgeId === me)) {
      return res.status(409).json({ message: 'You have already assessed this employee' })
    }

    const criteria = getCriteria(subject.candidate.promoteGrade)
    if (!criteria) {
      return res.status(400).json({ message: `There are no assessment criteria for ${subject.candidate.promoteGrade}` })
    }

    const toeic = subject.candidate.toeic
    const result = computeAssessment(criteria, req.body.scores, toeic)
    if (result.error) {
      return res.status(400).json({ message: result.error })
    }

    const decision = resolveStatusAndComment({
      status: req.body.status,
      comment: req.body.comment,
      finalScore: result.finalScore,
    })
    if (decision.error) {
      return res.status(400).json({ message: decision.error })
    }

    const judge = await Employee.findOne({ where: { employeeId: me }, attributes: ['name'] })

    // The unique index (period, employee, judge) also stops a double submit that slips past the check above.
    const assessment = await PresentationAssessment.create({
      periodeId: periode.id,
      employeeId: subject.candidate.employeeId,
      judgeId: me,
      judgeName: judge?.name || me,
      promoteGrade: subject.candidate.promoteGrade,
      scores: JSON.stringify(result.items),
      assessmentScore: result.assessmentScore,
      toeic,
      finalScore: result.finalScore,
      status: req.body.status,
      comment: decision.comment,
    })

    return res.status(201).json({ message: 'Assessment submitted', assessment: toAssessmentDto(assessment) })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'You have already assessed this employee' })
    }
    console.error('Submit assessment error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Submitted tasks of the employees the logged-in judge is assigned to, split into the ones they
// still have to review (inProgress) and the ones they reviewed or admin already decided (completed).
export const getMyTaskList = async (req, res) => {
  try {
    const me = req.user.employeeId
    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res.status(200).json({ inProgress: [], completed: [] })
    }

    const links = await EmployeeJudge.findAll({ where: { judgeId: me }, attributes: ['employeeId'], raw: true })
    const employeeIds = links.map((link) => link.employeeId)
    if (employeeIds.length === 0) {
      return res.status(200).json({ inProgress: [], completed: [] })
    }

    const decisions = await PresentationDecision.findAll({
      where: { employeeId: employeeIds, periodeId: periode.id, taskSubmittedAt: { [Op.ne]: null } },
    })
    const taskIds = decisions.map((d) => d.employeeId)
    if (taskIds.length === 0) {
      return res.status(200).json({ inProgress: [], completed: [] })
    }

    const [promotions, reviews, taskDecisions, allLinks] = await Promise.all([
      EmployeePromotion.findAll({ where: { employeeId: taskIds, periodeId: periode.id } }),
      TaskReview.findAll({ where: { employeeId: taskIds, periodeId: periode.id } }),
      TaskDecision.findAll({ where: { employeeId: taskIds, periodeId: periode.id } }),
      EmployeeJudge.findAll({ where: { employeeId: taskIds }, attributes: ['employeeId'], raw: true }),
    ])

    const decisionById = new Map(decisions.map((d) => [d.employeeId, d]))
    const taskDecisionById = new Map(taskDecisions.map((d) => [d.employeeId, d]))
    const myReviewById = new Map(reviews.filter((r) => r.judgeId === me).map((r) => [r.employeeId, r]))
    const countBy = (rows) =>
      rows.reduce((map, row) => map.set(row.employeeId, (map.get(row.employeeId) || 0) + 1), new Map())
    const judgeCount = countBy(allLinks)
    const reviewCount = countBy(reviews)

    const rows = promotions
      .map((promotion) => {
        const myReview = myReviewById.get(promotion.employeeId)
        const taskDecision = taskDecisionById.get(promotion.employeeId)
        return {
          employeeId: promotion.employeeId,
          name: promotion.name,
          department: promotion.department,
          promoteGrade: promotion.promoteGrade,
          taskSubmittedAt: decisionById.get(promotion.employeeId).taskSubmittedAt,
          judgesTotal: judgeCount.get(promotion.employeeId) || 0,
          judgesReviewed: reviewCount.get(promotion.employeeId) || 0,
          myReview: myReview ? toTaskReviewDto(myReview) : null,
          taskDecision: toTaskDecisionDto(taskDecision),
        }
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const isDone = (row) => row.myReview || row.taskDecision
    return res.status(200).json({
      inProgress: rows.filter((row) => !isDone(row)),
      completed: rows.filter(isDone),
    })
  } catch (error) {
    console.error('Get task list error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Data for the task review modal. Polled while open, so other judges' reviews show up right away.
export const getTaskReviewForm = async (req, res) => {
  try {
    const context = await loadForJudge(req, res)
    if (!context) return
    const { periode, subject } = context
    const me = req.user.employeeId

    if (!subject.taskSubmitted) {
      return res.status(404).json({ message: 'This employee has not submitted a task' })
    }

    const files = await TaskSubmissionFile.findAll({
      where: { employeeId: subject.candidate.employeeId, periodeId: periode.id },
      order: [['createdAt', 'ASC']],
    })
    const mine = subject.taskReviews.find((r) => r.judgeId === me)

    let reason = null
    if (mine) reason = 'You have already reviewed this task.'
    else if (subject.taskDecision) reason = 'Admin has already made the final decision on this task.'

    return res.status(200).json({
      candidate: subject.candidate,
      task: {
        text: subject.decision.comment,
        submittedAt: subject.decision.taskSubmittedAt,
        files: files.map((file) => ({
          id: file.id,
          originalName: file.originalName,
          size: file.size,
          uploadedAt: file.createdAt,
        })),
      },
      canReview: !reason,
      reason,
      myReview: mine ? toTaskReviewDto(mine) : null,
      otherReviews: subject.taskReviews.filter((r) => r.judgeId !== me).map(toTaskReviewDto),
      // Presentation assessments of every judge (also judges replaced later), so a newly assigned
      // judge has the full history behind the task.
      assessments: subject.assessments.map((a) => toAssessmentDto(a)),
      presentationResult: {
        status: subject.decision.status,
        statusLabel: RESULT_STATUS[subject.decision.status] || subject.decision.status,
        decidedAt: subject.decision.updatedAt,
      },
      pendingJudges: subject.judges.filter((j) => !j.taskReviewed && j.employeeId !== me).map((j) => j.name),
      taskDecision: toTaskDecisionDto(subject.taskDecision),
    })
  } catch (error) {
    console.error('Get task review form error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const submitTaskReview = async (req, res) => {
  try {
    const context = await loadForJudge(req, res)
    if (!context) return
    const { periode, subject } = context
    const me = req.user.employeeId

    if (!subject.taskSubmitted) {
      return res.status(400).json({ message: 'This employee has not submitted a task' })
    }
    if (subject.taskDecision) {
      return res.status(400).json({ message: 'Admin has already made the final decision on this task' })
    }
    if (subject.taskReviews.some((r) => r.judgeId === me)) {
      return res.status(409).json({ message: 'You have already reviewed this task' })
    }

    const resolved = resolveTaskDecision({ decision: req.body.decision, comment: req.body.comment })
    if (resolved.error) {
      return res.status(400).json({ message: resolved.error })
    }

    const judge = await Employee.findOne({ where: { employeeId: me }, attributes: ['name'] })
    await TaskReview.create({
      periodeId: periode.id,
      employeeId: subject.candidate.employeeId,
      judgeId: me,
      judgeName: judge?.name || me,
      decision: req.body.decision,
      comment: resolved.comment,
    })

    // Notification 8 (config/notificationTemplates.js).
    notify('taskReview', {
      employeeId: subject.candidate.employeeId,
      periode,
      actorId: me,
      vars: {
        decision: req.body.decision === 'approve' ? 'Approved' : 'Rejected',
        judgeName: judge?.name || me,
        comment: resolved.comment,
      },
    })

    return res.status(201).json({ message: 'Task review submitted' })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'You have already reviewed this task' })
    }
    console.error('Submit task review error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
