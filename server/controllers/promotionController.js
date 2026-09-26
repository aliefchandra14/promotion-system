import { Op } from 'sequelize'
import {
  sequelize,
  Employee,
  Periode,
  PromotionRequest,
  EmployeeJudge,
  EmployeePromotion,
  PromotionSummary,
} from '../models/index.js'
import { addToSummary } from '../services/summaryService.js'
import { findPresentationFor } from '../services/submissionAccess.js'

const TYPES = ['eligibility', 'submission']

export const getMyPromotions = async (req, res) => {
  try {
    const activePeriode = await Periode.findOne({ where: { status: 'active' } })

    if (!activePeriode) {
      return res.status(200).json({ periode: null, requests: [], promotion: null, presentation: null })
    }

    const [requests, promotion] = await Promise.all([
      PromotionRequest.findAll({
        where: { employeeId: req.user.employeeId, periodeId: activePeriode.id },
      }),
      EmployeePromotion.findOne({
        where: { employeeId: req.user.employeeId, periodeId: activePeriode.id },
      }),
    ])

    // Schedule + open/closed switch for the employee's target grade (null if admin has not set one up).
    const presentation = await findPresentationFor(promotion, activePeriode.id)

    return res.status(200).json({ periode: activePeriode, requests, promotion, presentation })
  } catch (error) {
    console.error('Get my promotions error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const startPromotionRequest = async (req, res) => {
  try {
    const { type } = req.body

    if (!TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid request type' })
    }

    const activePeriode = await Periode.findOne({ where: { status: 'active' } })
    if (!activePeriode) {
      return res.status(400).json({ message: 'No active promotion period' })
    }

    const employee = await Employee.findOne({ where: { employeeId: req.user.employeeId } })
    if (!employee?.superior) {
      return res.status(400).json({ message: 'You do not have a superior assigned yet, contact admin' })
    }

    if (type === 'submission') {
      const promotion = await EmployeePromotion.findOne({
        where: { employeeId: employee.employeeId, periodeId: activePeriode.id },
      })
      if (promotion?.adminDecision !== 'eligible_for_submission') {
        return res.status(400).json({ message: 'You are not yet eligible to submit for this period' })
      }

      const presentation = await findPresentationFor(promotion, activePeriode.id)
      if (!presentation?.isOpen) {
        return res.status(400).json({ message: 'Submission is not open yet for your grade' })
      }
    }

    const [request, created] = await PromotionRequest.findOrCreate({
      where: { employeeId: employee.employeeId, periodeId: activePeriode.id, type },
      defaults: { status: 'pending_superior' },
    })

    if (!created) {
      return res.status(409).json({ message: 'A request already exists for this period', request })
    }

    return res.status(201).json({ message: 'Request submitted', request })
  } catch (error) {
    console.error('Start promotion request error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

const MEMBER_SORTABLE_FIELDS = {
  employeeId: (r) => r.employeeId,
  name: (r) => r.employee?.name || '',
  department: (r) => r.employee?.department || '',
  currentGrade: (r) => r.promotion?.currentGrade || '',
  promoteGrade: (r) => r.promotion?.promoteGrade || '',
  type: (r) => r.promotion?.type || '',
  toeic: (r) => (r.promotion?.toeic ?? -1),
  presentation: (r) => r.promotion?.presentation || '',
  superiorRemark: (r) => r.superiorRemark || '',
  stage: (r) => r.stage,
  createdAt: (r) => new Date(r.createdAt).getTime(),
}

// Every column shown in the Members table is searchable (toeic uses -1 when empty, skipped above).
const MEMBER_SEARCH_FIELDS = [
  'employeeId',
  'name',
  'department',
  'currentGrade',
  'promoteGrade',
  'type',
  'toeic',
  'presentation',
  'superiorRemark',
  'stage',
]

const emptyMemberResponse = (page, limit) => ({
  requests: [],
  total: 0,
  page,
  limit,
  totalPages: 1,
})

export const getMemberRequests = async (req, res) => {
  try {
    const {
      type,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    if (!TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid query parameters' })
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const me = req.user.employeeId

    const [superiorMembers, hodMembers] = await Promise.all([
      Employee.findAll({ where: { superior: me }, attributes: ['employeeId'], raw: true }),
      Employee.findAll({ where: { hod: me }, attributes: ['employeeId'], raw: true }),
    ])
    const superiorIds = superiorMembers.map((m) => m.employeeId)
    const hodIds = hodMembers.map((m) => m.employeeId)

    if (superiorIds.length === 0 && hodIds.length === 0) {
      return res.status(200).json(emptyMemberResponse(pageNumber, pageSize))
    }

    const activePeriode = await Periode.findOne({ where: { status: 'active' } })
    if (!activePeriode) {
      return res.status(200).json(emptyMemberResponse(pageNumber, pageSize))
    }

    const orConditions = []
    if (superiorIds.length) orConditions.push({ employeeId: superiorIds, status: 'pending_superior' })
    if (hodIds.length) orConditions.push({ employeeId: hodIds, status: 'pending_hod' })

    const rawRequests = await PromotionRequest.findAll({
      where: { periodeId: activePeriode.id, type, [Op.or]: orConditions },
      include: [{ model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'department', 'grade'] }],
    })

    const promotions = await EmployeePromotion.findAll({
      where: { employeeId: rawRequests.map((r) => r.employeeId), periodeId: activePeriode.id },
    })
    const promotionByEmployeeId = new Map(promotions.map((p) => [p.employeeId, p]))

    let enriched = rawRequests.map((request) => ({
      ...request.toJSON(),
      stage: request.status === 'pending_superior' ? 'superior' : 'hod',
      promotion: promotionByEmployeeId.get(request.employeeId) || null,
    }))

    if (search) {
      const term = search.trim().toLowerCase()
      enriched = enriched.filter((r) =>
        MEMBER_SEARCH_FIELDS.some((field) => {
          const value = MEMBER_SORTABLE_FIELDS[field](r)
          if (value === null || value === undefined || value === '' || value === -1) return false
          return String(value).toLowerCase().includes(term)
        })
      )
    }

    const sortAccessor = MEMBER_SORTABLE_FIELDS[sortBy] || MEMBER_SORTABLE_FIELDS.createdAt
    const direction = String(sortOrder).toUpperCase() === 'ASC' ? 1 : -1
    enriched.sort((a, b) => {
      const aVal = sortAccessor(a)
      const bVal = sortAccessor(b)
      if (aVal < bVal) return -1 * direction
      if (aVal > bVal) return 1 * direction
      return 0
    })

    const total = enriched.length
    const totalPages = Math.max(Math.ceil(total / pageSize), 1)
    const start = (pageNumber - 1) * pageSize
    const pageItems = enriched.slice(start, start + pageSize)

    return res.status(200).json({
      requests: pageItems,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages,
    })
  } catch (error) {
    console.error('Get member requests error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// Number of people (not requests) currently waiting for the logged-in user's decision,
// as superior (pending_superior) or HOD (pending_hod), in the active period.
export const getPendingCount = async (req, res) => {
  try {
    const me = req.user.employeeId

    const [activePeriode, superiorMembers, hodMembers] = await Promise.all([
      Periode.findOne({ where: { status: 'active' }, attributes: ['id'] }),
      Employee.findAll({ where: { superior: me }, attributes: ['employeeId'], raw: true }),
      Employee.findAll({ where: { hod: me }, attributes: ['employeeId'], raw: true }),
    ])

    const superiorIds = superiorMembers.map((m) => m.employeeId)
    const hodIds = hodMembers.map((m) => m.employeeId)

    if (!activePeriode || (superiorIds.length === 0 && hodIds.length === 0)) {
      return res.status(200).json({ pending: 0 })
    }

    const orConditions = []
    if (superiorIds.length) orConditions.push({ employeeId: superiorIds, status: 'pending_superior' })
    if (hodIds.length) orConditions.push({ employeeId: hodIds, status: 'pending_hod' })

    const pending = await PromotionRequest.count({
      where: { periodeId: activePeriode.id, [Op.or]: orConditions },
      distinct: true,
      col: 'employeeId',
    })

    return res.status(200).json({ pending })
  } catch (error) {
    console.error('Get pending count error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

const ELIGIBILITY_ACTIONS = ['eligible_for_submission', 'summarized', 'delete']

export const getEligibilityMonitor = async (req, res) => {
  try {
    const {
      view = 'active',
      search = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const activePeriode = await Periode.findOne({ where: { status: 'active' } })
    if (!activePeriode) {
      return res.status(200).json({
        items: [],
        total: 0,
        page: pageNumber,
        limit: pageSize,
        totalPages: 1,
        periode: null,
        counts: { active: 0, rejected: 0 },
      })
    }

    const where = { periodeId: activePeriode.id, type: 'eligibility' }

    const requests = await PromotionRequest.findAll({
      where,
      include: [{ model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'department', 'grade'] }],
    })

    const promotions = await EmployeePromotion.findAll({
      where: { employeeId: requests.map((r) => r.employeeId), periodeId: activePeriode.id },
    })
    const promotionByEmployeeId = new Map(promotions.map((p) => [p.employeeId, p]))

    // Anyone already moved to the summary is finished here, so they no longer appear in monitoring.
    const summarized = await PromotionSummary.findAll({
      where: { periodeId: activePeriode.id, employeeId: requests.map((r) => r.employeeId) },
      attributes: ['employeeId'],
      raw: true,
    })
    const summarizedIds = new Set(summarized.map((s) => s.employeeId))

    let items = requests
      .filter((request) => !summarizedIds.has(request.employeeId))
      .map((request) => ({
        ...request.toJSON(),
        promotion: promotionByEmployeeId.get(request.employeeId) || null,
      }))

    // Rejected employees are kept apart from everyone still in the process (own tab, own actions).
    const counts = {
      active: items.filter((item) => item.status !== 'rejected').length,
      rejected: items.filter((item) => item.status === 'rejected').length,
    }

    if (view === 'rejected') {
      items = items.filter((item) => item.status === 'rejected')
    } else {
      items = items.filter((item) => item.status !== 'rejected')
      if (['pending_superior', 'pending_hod', 'approved'].includes(status)) {
        items = items.filter((item) => item.status === status)
      }
    }

    if (search) {
      const term = search.toLowerCase()
      items = items.filter(
        (r) => r.employeeId.toLowerCase().includes(term) || (r.employee?.name || '').toLowerCase().includes(term)
      )
    }

    const sortAccessor = MEMBER_SORTABLE_FIELDS[sortBy] || MEMBER_SORTABLE_FIELDS.createdAt
    const direction = String(sortOrder).toUpperCase() === 'ASC' ? 1 : -1
    items.sort((a, b) => {
      const aVal = sortAccessor(a)
      const bVal = sortAccessor(b)
      if (aVal < bVal) return -1 * direction
      if (aVal > bVal) return 1 * direction
      return 0
    })

    const total = items.length
    const totalPages = Math.max(Math.ceil(total / pageSize), 1)
    const start = (pageNumber - 1) * pageSize
    const pageItems = items.slice(start, start + pageSize)

    return res.status(200).json({
      items: pageItems,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages,
      periode: activePeriode,
      counts,
    })
  } catch (error) {
    console.error('Get eligibility monitor error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const bulkEligibilityAction = async (req, res) => {
  try {
    const { employeeIds, action } = req.body

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one employee' })
    }
    if (!ELIGIBILITY_ACTIONS.includes(action)) {
      return res.status(400).json({ message: 'Invalid action' })
    }

    const activePeriode = await Periode.findOne({ where: { status: 'active' } })
    if (!activePeriode) {
      return res.status(400).json({ message: 'No active promotion period' })
    }

    if (action === 'delete') {
      await PromotionRequest.destroy({ where: { employeeId: employeeIds, periodeId: activePeriode.id } })
      await EmployeePromotion.destroy({ where: { employeeId: employeeIds, periodeId: activePeriode.id } })
      return res.status(200).json({ message: `Deleted ${employeeIds.length} employee promotion record(s)` })
    }

    const approvedRequests = await PromotionRequest.findAll({
      where: {
        employeeId: employeeIds,
        periodeId: activePeriode.id,
        type: 'eligibility',
        status: 'approved',
      },
      attributes: ['employeeId'],
      raw: true,
    })
    const approvedIds = approvedRequests.map((r) => r.employeeId)
    const skipped = employeeIds.filter((id) => !approvedIds.includes(id))

    if (approvedIds.length > 0) {
      if (action === 'summarized') {
        const promotions = await EmployeePromotion.findAll({
          where: { employeeId: approvedIds, periodeId: activePeriode.id },
        })
        await sequelize.transaction(async (transaction) => {
          for (const promotion of promotions) {
            await addToSummary({ promotion, periode: activePeriode, transaction })
          }
        })
      } else {
        await EmployeePromotion.update(
          { adminDecision: action },
          { where: { employeeId: approvedIds, periodeId: activePeriode.id } }
        )
      }
    }

    const actionLabel = action === 'eligible_for_submission' ? 'marked eligible for submission' : 'moved to summary'

    return res.status(200).json({
      message:
        skipped.length > 0
          ? `${approvedIds.length} employee(s) ${actionLabel}. ${skipped.length} skipped (eligibility not yet approved).`
          : `${approvedIds.length} employee(s) ${actionLabel}.`,
      updated: approvedIds.length,
      skipped: skipped.length,
    })
  } catch (error) {
    console.error('Bulk eligibility action error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const decideRequest = async (req, res) => {
  try {
    const { id } = req.params
    const { decision, remark } = req.body

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject' })
    }

    const request = await PromotionRequest.findByPk(id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }

    const employee = await Employee.findOne({ where: { employeeId: request.employeeId } })
    const me = req.user.employeeId

    if (request.status === 'pending_superior') {
      if (employee?.superior !== me) {
        return res.status(403).json({ message: 'You are not the superior for this employee' })
      }
      request.superiorDecision = decision
      request.superiorDecidedAt = new Date()
      request.superiorRemark = remark || null
      request.status = decision === 'approve' ? 'pending_hod' : 'rejected'
    } else if (request.status === 'pending_hod') {
      if (employee?.hod !== me) {
        return res.status(403).json({ message: 'You are not the HOD for this employee' })
      }
      request.hodDecision = decision
      request.hodDecidedAt = new Date()
      request.hodRemark = remark || null
      request.status = decision === 'approve' ? 'approved' : 'rejected'
    } else {
      return res.status(400).json({ message: 'This request has already been finalized' })
    }

    // Eligibility approved by the HOD and no presentation needed -> straight into the summary.
    let movedToSummary = false
    await sequelize.transaction(async (transaction) => {
      await request.save({ transaction })

      if (request.type === 'eligibility' && request.status === 'approved') {
        const promotion = await EmployeePromotion.findOne({
          where: { employeeId: request.employeeId, periodeId: request.periodeId },
          transaction,
        })

        if (promotion && promotion.presentation === 'NO') {
          const periode = await Periode.findByPk(request.periodeId, { transaction })
          await addToSummary({ promotion, periode, transaction })
          movedToSummary = true
        }
      }
    })

    return res.status(200).json({
      message: movedToSummary ? 'Decision recorded. Moved to summary automatically.' : 'Decision recorded',
      request,
      movedToSummary,
    })
  } catch (error) {
    console.error('Decide request error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const getJudgingAssignments = async (req, res) => {
  try {
    const judgeId = req.user.employeeId
    const links = await EmployeeJudge.findAll({ where: { judgeId } })
    const employeeIds = links.map((link) => link.employeeId)

    const employees = employeeIds.length
      ? await Employee.findAll({
          where: { employeeId: employeeIds },
          attributes: ['employeeId', 'name', 'department', 'grade'],
        })
      : []

    return res.status(200).json({ employees })
  } catch (error) {
    console.error('Get judging assignments error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
