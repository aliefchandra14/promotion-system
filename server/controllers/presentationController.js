import { Op } from 'sequelize'
import {
  sequelize,
  Employee,
  EmployeeJudge,
  EmployeePromotion,
  Periode,
  PromotionPresentation,
  PromotionRequest,
  PresentationReminderLog,
  PresentationAssessment,
  PresentationDecision,
  TaskSubmissionFile,
  TaskDecision,
  TaskReview,
  PromotionSummary,
} from '../models/index.js'
import {
  RESULT_STATUS,
  loadAssessmentSubject,
  resolveStatusAndComment,
  toAssessmentDto,
  toDecisionDto,
  TASK_RESULT_STATUS,
  resolveTaskDecision,
  toTaskReviewDto,
  toTaskDecisionDto,
} from '../services/assessmentService.js'
import { addToSummary } from '../services/summaryService.js'
import { getNextPeriode, carryOverPending, undoCarryOver } from '../services/periodeService.js'
import { notify } from '../services/notificationService.js'
import { getFiscalYearLabel } from '../constants/fiscalYear.js'
import { GRADES } from '../constants/grades.js'
import { todayString, closeExpiredPresentations } from '../services/presentationService.js'
import { isDevMode } from '../services/appMode.js'
import {
  SUBMISSION_STATUS,
  PRESENTATION_STATUS,
  getSubmissionStatus,
  getPresentationStatus,
} from '../services/submissionStatus.js'

const PROJECT_GRADES = GRADES.filter((grade) => grade.project).map((grade) => grade.title)

const SORTABLE_FIELDS = [
  'grade',
  'briefingStart',
  'submissionStart',
  'presentationStart',
  'isOpen',
  'createdAt',
]

const DATE_PAIRS = [
  ['briefingStart', 'briefingEnd', 'Briefing'],
  ['submissionStart', 'submissionEnd', 'Submission'],
  ['presentationStart', 'presentationEnd', 'Presentation'],
]

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

// Returns an error message, or null when the dates are all present, valid and start <= end.
const validateDates = (body) => {
  for (const [startKey, endKey, label] of DATE_PAIRS) {
    const start = body[startKey]
    const end = body[endKey]

    if (!isValidDate(start) || !isValidDate(end)) {
      return `${label} start and end dates are required and must be valid dates`
    }
    if (start > end) {
      return `${label} end date cannot be before its start date`
    }
  }
  return null
}

// Start dates cannot be in the past (not checked in development mode). When editing, a start date that is
// left unchanged is always accepted, so an ongoing presentation can still be updated after its start date.
const validateStartDates = (body, existing = null) => {
  const today = todayString()
  for (const [startKey, , label] of DATE_PAIRS) {
    const unchanged = existing && existing[startKey] === body[startKey]
    if (!unchanged && body[startKey] < today) {
      return `${label} start date cannot be in the past`
    }
  }
  return null
}

const pickDates = (body) => {
  const dates = {}
  for (const [startKey, endKey] of DATE_PAIRS) {
    dates[startKey] = body[startKey]
    dates[endKey] = body[endKey]
  }
  return dates
}

export const getPresentations = async (req, res) => {
  try {
    await closeExpiredPresentations()

    const {
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res
        .status(200)
        .json({ presentations: [], total: 0, page: pageNumber, limit: pageSize, totalPages: 1, periode: null })
    }

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const where = { periodeId: periode.id }
    const term = String(search).trim()
    if (term) {
      where.grade = { [Op.like]: `%${term}%` }
    }

    const { rows, count } = await PromotionPresentation.findAndCountAll({
      where,
      order: [
        [sortField, sortDirection],
        ['id', 'ASC'],
      ],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    })

    // When each reminder (briefing / submission / presentation) was last sent for these rows.
    const logs = rows.length
      ? await PresentationReminderLog.findAll({
          where: { presentationId: rows.map((row) => row.id) },
          order: [['createdAt', 'DESC']],
        })
      : []
    const lastSent = new Map()
    for (const log of logs) {
      const key = `${log.presentationId}:${log.type}`
      if (!lastSent.has(key)) {
        lastSent.set(key, { sentAt: log.createdAt, sentCount: log.sentCount, simulated: log.simulated })
      }
    }
    const presentations = rows.map((row) => ({
      ...row.toJSON(),
      reminders: {
        briefing: lastSent.get(`${row.id}:briefing`) || null,
        submission: lastSent.get(`${row.id}:submission`) || null,
        presentation: lastSent.get(`${row.id}:presentation`) || null,
      },
    }))

    return res.status(200).json({
      presentations,
      total: count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(count / pageSize), 1),
      periode,
    })
  } catch (error) {
    console.error('Get presentations error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const createPresentation = async (req, res) => {
  try {
    const { grade, isOpen } = req.body

    if (!PROJECT_GRADES.includes(grade)) {
      return res.status(400).json({ message: 'Please choose a grade that requires a project' })
    }

    const dateError = validateDates(req.body)
    if (dateError) {
      return res.status(400).json({ message: dateError })
    }

    const pastError = (await isDevMode()) ? null : validateStartDates(req.body)
    if (pastError) {
      return res.status(400).json({ message: pastError })
    }

    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res.status(400).json({ message: 'Please activate a promotion period first' })
    }

    const existing = await PromotionPresentation.findOne({ where: { periodeId: periode.id, grade } })
    if (existing) {
      return res.status(409).json({ message: `A presentation for ${grade} already exists in this period` })
    }

    const presentation = await PromotionPresentation.create({
      periodeId: periode.id,
      grade,
      ...pickDates(req.body),
      isOpen: isOpen === true,
    })

    return res.status(201).json({ message: 'Presentation added', presentation })
  } catch (error) {
    console.error('Create presentation error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const updatePresentation = async (req, res) => {
  try {
    const presentation = await PromotionPresentation.findByPk(req.params.id)
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' })
    }

    const dateError = validateDates(req.body)
    if (dateError) {
      return res.status(400).json({ message: dateError })
    }

    const devMode = await isDevMode()
    const pastError = devMode ? null : validateStartDates(req.body, presentation)
    if (pastError) {
      return res.status(400).json({ message: pastError })
    }

    if (!devMode && req.body.isOpen === true && req.body.submissionEnd < todayString()) {
      return res.status(400).json({
        message: 'The submission end date has passed. Extend it before opening submission.',
      })
    }

    await presentation.update({
      ...pickDates(req.body),
      isOpen: req.body.isOpen === true,
    })

    return res.status(200).json({ message: 'Presentation updated', presentation })
  } catch (error) {
    console.error('Update presentation error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

const CANDIDATE_SORTABLE_FIELDS = {
  name: (c) => c.name || '',
  employeeId: (c) => c.employeeId,
  department: (c) => c.department || '',
  promoteGrade: (c) => c.promoteGrade || '',
  submissionStatus: (c) => Object.keys(SUBMISSION_STATUS).indexOf(c.submissionStatus.key),
  presentationStatus: (c) => Object.keys(PRESENTATION_STATUS).indexOf(c.presentationStatus),
}

// Employees in this presentation's period who are eligible for submission and are being
// promoted to its grade, each with their submission status and assigned judges.
// Employees already moved to the summary after their presentation stay listed with their result.
const loadCandidates = async (presentation) => {
  const allPromotions = await EmployeePromotion.findAll({
    where: {
      periodeId: presentation.periodeId,
      promoteGrade: presentation.grade,
      adminDecision: ['eligible_for_submission', 'summarized'],
    },
  })
  if (allPromotions.length === 0) return []

  const decisions = await PresentationDecision.findAll({
    where: { employeeId: allPromotions.map((p) => p.employeeId), periodeId: presentation.periodeId },
  })
  const decisionById = new Map(decisions.map((d) => [d.employeeId, d]))
  const promotions = allPromotions.filter(
    (p) => p.adminDecision === 'eligible_for_submission' || decisionById.has(p.employeeId)
  )
  const employeeIds = promotions.map((p) => p.employeeId)
  if (employeeIds.length === 0) return []

  const [employees, requests, judgeLinks, assessments, taskReviews, taskDecisions] = await Promise.all([
    Employee.findAll({
      where: { employeeId: employeeIds },
      attributes: ['employeeId', 'name', 'department', 'superior', 'hod'],
      include: [
        { model: Employee, as: 'superiorInfo', attributes: ['employeeId', 'name'] },
        { model: Employee, as: 'hodInfo', attributes: ['employeeId', 'name'] },
      ],
    }),
    PromotionRequest.findAll({
      where: { employeeId: employeeIds, periodeId: presentation.periodeId, type: 'submission' },
    }),
    EmployeeJudge.findAll({
      where: { employeeId: employeeIds },
      include: [{ model: Employee, as: 'judge', attributes: ['employeeId', 'name', 'department'] }],
    }),
    PresentationAssessment.findAll({
      where: { employeeId: employeeIds, periodeId: presentation.periodeId },
      attributes: ['employeeId', 'judgeId'],
      raw: true,
    }),
    TaskReview.findAll({
      where: { employeeId: employeeIds, periodeId: presentation.periodeId },
      attributes: ['employeeId', 'judgeId'],
      raw: true,
    }),
    TaskDecision.findAll({ where: { employeeId: employeeIds, periodeId: presentation.periodeId } }),
  ])

  const employeeById = new Map(employees.map((e) => [e.employeeId, e]))
  const requestById = new Map(requests.map((r) => [r.employeeId, r]))
  const taskDecisionById = new Map(taskDecisions.map((d) => [d.employeeId, d]))
  const taskReviewCount = taskReviews.reduce(
    (map, review) => map.set(review.employeeId, (map.get(review.employeeId) || 0) + 1),
    new Map()
  )
  const assessedKeys = new Set(assessments.map((a) => `${a.employeeId}:${a.judgeId}`))
  const taskReviewedKeys = new Set(taskReviews.map((r) => `${r.employeeId}:${r.judgeId}`))
  const judgesById = new Map()
  for (const link of judgeLinks) {
    if (!judgesById.has(link.employeeId)) judgesById.set(link.employeeId, [])
    judgesById
      .get(link.employeeId)
      .push({
        ...(link.judge ? link.judge.toJSON() : { employeeId: link.judgeId, name: link.judgeId, department: null }),
        assessed: assessedKeys.has(`${link.employeeId}:${link.judgeId}`),
        taskReviewed: taskReviewedKeys.has(`${link.employeeId}:${link.judgeId}`),
      })
  }

  return promotions.map((promotion) => {
    const employee = employeeById.get(promotion.employeeId)
    const request = requestById.get(promotion.employeeId) || null
    const judges = judgesById.get(promotion.employeeId) || []
    const assessedCount = judges.filter((judge) => judge.assessed).length
    const decision = decisionById.get(promotion.employeeId) || null
    const submissionStatus = getSubmissionStatus(request, {
      superiorName: employee?.superiorInfo?.name || employee?.superior || null,
      hodName: employee?.hodInfo?.name || employee?.hod || null,
    })

    return {
      employeeId: promotion.employeeId,
      name: promotion.name || employee?.name,
      department: promotion.department || employee?.department || null,
      promoteGrade: promotion.promoteGrade,
      submissionStatus,
      submissionRemark: request?.status === 'rejected' ? request.hodRemark || request.superiorRemark : null,
      presentationStatus: getPresentationStatus(submissionStatus.key, judges.length, assessedCount, Boolean(decision)),
      judges,
      assessedCount,
      decision: toDecisionDto(decision),
      taskReviewedCount: taskReviewCount.get(promotion.employeeId) || 0,
      taskDecision: toTaskDecisionDto(taskDecisionById.get(promotion.employeeId)),
    }
  })
}

export const getPresentationCandidates = async (req, res) => {
  try {
    const {
      search = '',
      submissionStatus = '',
      sortBy = 'name',
      sortOrder = 'ASC',
      page = '1',
      limit = '10',
    } = req.query

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const presentation = await PromotionPresentation.findByPk(req.params.id)
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' })
    }
    const periode = await Periode.findByPk(presentation.periodeId)

    let items = await loadCandidates(presentation)

    if (SUBMISSION_STATUS[submissionStatus]) {
      items = items.filter((item) => item.submissionStatus.key === submissionStatus)
    }

    const term = String(search).trim().toLowerCase()
    if (term) {
      items = items.filter((item) =>
        [item.employeeId, item.name, item.department].some((value) =>
          String(value || '').toLowerCase().includes(term)
        )
      )
    }

    const sortAccessor = CANDIDATE_SORTABLE_FIELDS[sortBy] || CANDIDATE_SORTABLE_FIELDS.name
    const direction = String(sortOrder).toUpperCase() === 'DESC' ? -1 : 1
    items.sort((a, b) => {
      const aVal = sortAccessor(a)
      const bVal = sortAccessor(b)
      if (aVal < bVal) return -1 * direction
      if (aVal > bVal) return 1 * direction
      return a.employeeId < b.employeeId ? -1 : 1
    })

    const total = items.length
    const start = (pageNumber - 1) * pageSize

    return res.status(200).json({
      presentation,
      periode,
      candidates: items.slice(start, start + pageSize),
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    })
  } catch (error) {
    console.error('Get presentation candidates error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Loads the candidate and checks they may present (submission complete). Sends the error
// response itself and returns null when the judge change cannot go ahead.
const loadEligibleCandidate = async (req, res) => {
  const presentation = await PromotionPresentation.findByPk(req.params.id)
  if (!presentation) {
    res.status(404).json({ message: 'Presentation not found' })
    return null
  }

  const candidates = await loadCandidates(presentation)
  const candidate = candidates.find((c) => c.employeeId === req.params.employeeId)
  if (!candidate) {
    res.status(404).json({ message: 'This employee is not a candidate of this presentation' })
    return null
  }
  if (candidate.submissionStatus.key !== 'complete') {
    res.status(400).json({ message: 'Judges can only be assigned once the submission is complete' })
    return null
  }
  return { presentation, candidate }
}

// Judges cannot change once the final decision is made.
const loadJudgeEditableCandidate = async (req, res) => {
  const loaded = await loadEligibleCandidate(req, res)
  if (!loaded) return null
  if (loaded.candidate.decision) {
    res.status(400).json({ message: 'The final decision has been made, judges can no longer be changed' })
    return null
  }
  return loaded.candidate
}

export const addCandidateJudge = async (req, res) => {
  try {
    const candidate = await loadJudgeEditableCandidate(req, res)
    if (!candidate) return

    const judgeId = String(req.body.judgeId || '').trim()
    if (!/^[0-9]{6}$/.test(judgeId)) {
      return res.status(400).json({ message: 'Please choose a judge' })
    }
    if (judgeId === candidate.employeeId) {
      return res.status(400).json({ message: 'An employee cannot be their own judge' })
    }

    const judge = await Employee.findOne({ where: { employeeId: judgeId, isActive: true } })
    if (!judge) {
      return res.status(404).json({ message: 'Judge not found or inactive' })
    }

    const [, created] = await EmployeeJudge.findOrCreate({
      where: { employeeId: candidate.employeeId, judgeId },
    })
    if (!created) {
      return res.status(409).json({ message: `${judge.name} is already a judge for this employee` })
    }

    return res.status(201).json({ message: `${judge.name} added as judge` })
  } catch (error) {
    console.error('Add candidate judge error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const removeCandidateJudge = async (req, res) => {
  try {
    const candidate = await loadJudgeEditableCandidate(req, res)
    if (!candidate) return

    // A judge who already assessed stays, so their assessment keeps counting towards the decision.
    if (candidate.judges.some((judge) => judge.employeeId === req.params.judgeId && judge.assessed)) {
      return res.status(400).json({ message: 'This judge has already assessed the employee and cannot be removed' })
    }

    await EmployeeJudge.destroy({ where: { employeeId: candidate.employeeId, judgeId: req.params.judgeId } })
    return res.status(200).json({ message: 'Judge removed' })
  } catch (error) {
    console.error('Remove candidate judge error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// During the task stage (result "Recommended with Task", task not yet decided) a judge who has not
// reviewed the task can be swapped for another one, e.g. when they are unavailable. Their presentation
// assessment stays on record; the new judge sees all assessments and task reviews so far.
export const replaceCandidateJudge = async (req, res) => {
  try {
    const loaded = await loadEligibleCandidate(req, res)
    if (!loaded) return
    const { candidate } = loaded

    const isTaskStage =
      candidate.decision?.status === 'recommended_with_task' || Boolean(candidate.decision?.taskSubmittedAt)
    if (!isTaskStage) {
      return res.status(400).json({ message: 'Judges can only be changed while the task is being reviewed' })
    }
    if (candidate.taskDecision) {
      return res
        .status(400)
        .json({ message: 'The final decision on the task has been made, judges can no longer be changed' })
    }

    const current = candidate.judges.find((judge) => judge.employeeId === req.params.judgeId)
    if (!current) {
      return res.status(404).json({ message: 'This judge is not assigned to the employee' })
    }
    if (current.taskReviewed) {
      return res.status(400).json({ message: `${current.name} has already reviewed the task and cannot be changed` })
    }

    const newJudgeId = String(req.body.judgeId || '').trim()
    if (!/^[0-9]{6}$/.test(newJudgeId)) {
      return res.status(400).json({ message: 'Please choose the new judge' })
    }
    if (newJudgeId === candidate.employeeId) {
      return res.status(400).json({ message: 'An employee cannot be their own judge' })
    }
    if (candidate.judges.some((judge) => judge.employeeId === newJudgeId)) {
      return res.status(409).json({ message: 'This employee is already a judge for this candidate' })
    }

    const newJudge = await Employee.findOne({ where: { employeeId: newJudgeId, isActive: true } })
    if (!newJudge) {
      return res.status(404).json({ message: 'Judge not found or inactive' })
    }

    await sequelize.transaction(async (transaction) => {
      await EmployeeJudge.destroy({
        where: { employeeId: candidate.employeeId, judgeId: current.employeeId },
        transaction,
      })
      await EmployeeJudge.create({ employeeId: candidate.employeeId, judgeId: newJudgeId }, { transaction })
    })

    return res.status(200).json({ message: `${current.name} replaced by ${newJudge.name}` })
  } catch (error) {
    console.error('Replace candidate judge error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// All judges' assessments of a candidate plus the admin decision, for the Final Decision modal.
export const getCandidateAssessments = async (req, res) => {
  try {
    const presentation = await PromotionPresentation.findByPk(req.params.id)
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' })
    }

    const subject = await loadAssessmentSubject(req.params.employeeId, presentation.periodeId)
    if (!subject || subject.candidate.promoteGrade !== presentation.grade) {
      return res.status(404).json({ message: 'This employee is not a candidate of this presentation' })
    }

    const taskFiles = await TaskSubmissionFile.findAll({
      where: { employeeId: req.params.employeeId, periodeId: presentation.periodeId },
      order: [['createdAt', 'ASC']],
    })

    const scores = subject.assessments.map((a) => a.finalScore)
    return res.status(200).json({
      candidate: subject.candidate,
      judges: subject.judges,
      allAssessed: subject.allAssessed,
      averageFinalScore: scores.length
        ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100
        : null,
      assessments: subject.assessments.map((a) => toAssessmentDto(a, { withScores: true })),
      decision: toDecisionDto(subject.decision),
      taskFiles: taskFiles.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        uploadedAt: file.createdAt,
      })),
      taskReviews: subject.taskReviews.map(toTaskReviewDto),
      allTaskReviewed: subject.allTaskReviewed,
      taskDecision: toTaskDecisionDto(subject.taskDecision),
      statuses: RESULT_STATUS,
    })
  } catch (error) {
    console.error('Get candidate assessments error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Admin's final decision, once every judge has assessed. Can be changed until the employee
// has submitted their task.
export const saveCandidateDecision = async (req, res) => {
  try {
    const presentation = await PromotionPresentation.findByPk(req.params.id)
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' })
    }

    const subject = await loadAssessmentSubject(req.params.employeeId, presentation.periodeId)
    if (!subject || subject.candidate.promoteGrade !== presentation.grade) {
      return res.status(404).json({ message: 'This employee is not a candidate of this presentation' })
    }
    if (!subject.allAssessed) {
      return res.status(400).json({ message: 'Every judge must finish their assessment before the final decision' })
    }
    if (subject.decision?.taskSubmittedAt) {
      return res.status(400).json({ message: 'The employee has already submitted their task, the decision is locked' })
    }

    const resolved = resolveStatusAndComment({ status: req.body.status, comment: req.body.comment })
    if (resolved.error) {
      return res.status(400).json({ message: resolved.error })
    }

    const values = { status: req.body.status, comment: resolved.comment, decidedBy: req.user.employeeId }
    const withTask = req.body.status === 'recommended_with_task'
    const [promotion, periode] = await Promise.all([
      EmployeePromotion.findOne({
        where: { employeeId: subject.candidate.employeeId, periodeId: presentation.periodeId },
      }),
      Periode.findByPk(presentation.periodeId),
    ])

    const isPending = req.body.status === 'pending_6_month'
    const wasPending = subject.decision?.status === 'pending_6_month'
    // Prepare the next period up front (it may need creating), outside the transaction below.
    const nextPeriode = isPending || wasPending ? await getNextPeriode(periode) : null

    await sequelize.transaction(async (transaction) => {
      if (wasPending && !isPending) {
        const undone = await undoCarryOver({ promotion, periode, transaction })
        if (!undone) {
          const message = `The employee has already started their submission in ${nextPeriode.name}`
          throw Object.assign(new Error(message), { status: 400 })
        }
      }

      if (subject.decision) {
        await subject.decision.update(values, { transaction })
      } else {
        await PresentationDecision.create(
          { ...values, periodeId: presentation.periodeId, employeeId: subject.candidate.employeeId },
          { transaction }
        )
      }

      if (!withTask) {
        // Recommended / Not Recommended / Pending 6 Month are final: straight into the summary.
        await addToSummary({
          promotion,
          periode,
          status: RESULT_STATUS[req.body.status],
          remark: resolved.comment.slice(0, 500),
          transaction,
        })
      } else if (promotion.adminDecision === 'summarized') {
        // Changed to "with task": out of the summary again until admin decides on the task.
        await PromotionSummary.destroy({
          where: { employeeId: promotion.employeeId, periodeId: presentation.periodeId },
          transaction,
        })
        await promotion.update({ adminDecision: 'eligible_for_submission' }, { transaction })
      }

      if (isPending) {
        // Presents again in the next period, skipping the eligibility approval there.
        await carryOverPending({ promotion, periode, transaction })
      }
    })

    // Notification 6 (config/notificationTemplates.js).
    notify('presentationFinalDecision', {
      employeeId: subject.candidate.employeeId,
      periode,
      actorId: req.user.employeeId,
      vars: { result: RESULT_STATUS[req.body.status], comment: resolved.comment },
    })

    const nextNote = isPending
      ? ` Eligible for submission in ${nextPeriode.name} ${getFiscalYearLabel(nextPeriode.fiscalYear)}.`
      : ''
    return res.status(200).json({
      message: withTask
        ? `Final decision saved: ${RESULT_STATUS[req.body.status]}. Waiting for the employee's task.`
        : `Final decision saved: ${RESULT_STATUS[req.body.status]}, moved to summary.${nextNote}`,
    })
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message })
    }
    console.error('Save candidate decision error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Admin's final approve/reject of the submitted task, once every judge reviewed it.
// Approve -> result "recommended", reject -> "not_recommended"; the employee then goes to the summary.
export const saveCandidateTaskDecision = async (req, res) => {
  try {
    const presentation = await PromotionPresentation.findByPk(req.params.id)
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' })
    }

    const subject = await loadAssessmentSubject(req.params.employeeId, presentation.periodeId)
    if (!subject || subject.candidate.promoteGrade !== presentation.grade) {
      return res.status(404).json({ message: 'This employee is not a candidate of this presentation' })
    }
    if (!subject.taskSubmitted) {
      return res.status(400).json({ message: 'The employee has not submitted their task yet' })
    }
    if (subject.taskDecision) {
      return res.status(409).json({ message: 'The final decision on this task has already been made' })
    }
    if (!subject.allTaskReviewed) {
      return res.status(400).json({ message: 'Every judge must review the task before the final decision' })
    }

    const resolved = resolveTaskDecision({ decision: req.body.decision, comment: req.body.comment })
    if (resolved.error) {
      return res.status(400).json({ message: resolved.error })
    }

    const resultStatus = TASK_RESULT_STATUS[req.body.decision]
    const [promotion, periode] = await Promise.all([
      EmployeePromotion.findOne({
        where: { employeeId: subject.candidate.employeeId, periodeId: presentation.periodeId },
      }),
      Periode.findByPk(presentation.periodeId),
    ])

    await sequelize.transaction(async (transaction) => {
      await TaskDecision.create(
        {
          periodeId: presentation.periodeId,
          employeeId: subject.candidate.employeeId,
          decision: req.body.decision,
          comment: resolved.comment,
          decidedBy: req.user.employeeId,
        },
        { transaction }
      )
      await subject.decision.update({ status: resultStatus }, { transaction })
      await addToSummary({
        promotion,
        periode,
        status: RESULT_STATUS[resultStatus],
        remark: resolved.comment.slice(0, 500),
        transaction,
      })
    })

    // Notification 9 (config/notificationTemplates.js).
    notify('taskFinalDecision', {
      employeeId: subject.candidate.employeeId,
      periode,
      actorId: req.user.employeeId,
      vars: {
        decision: req.body.decision === 'approve' ? 'Approved' : 'Rejected',
        result: RESULT_STATUS[resultStatus],
        comment: resolved.comment,
      },
    })

    const decided = req.body.decision === 'approve' ? 'approved' : 'rejected'
    return res.status(200).json({
      message: `Task ${decided}. Result: ${RESULT_STATUS[resultStatus]}, moved to summary.`,
    })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'The final decision on this task has already been made' })
    }
    console.error('Save candidate task decision error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
