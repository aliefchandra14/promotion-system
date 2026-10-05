import { Op } from 'sequelize'
import {
  sequelize,
  Employee,
  EmployeePromotion,
  Periode,
  PromotionRequest,
  PromotionSummary,
} from '../models/index.js'
import { GRADES } from '../constants/grades.js'
import { addToSummary } from '../services/summaryService.js'
import { notify } from '../services/notificationService.js'

const SORTABLE_FIELDS = [
  'name',
  'employeeId',
  'department',
  'currentGrade',
  'promoteGrade',
  'fiscalYear',
  'periodeName',
  'type',
  'presentation',
  'status',
  'remark',
  'createdAt',
]

const SEARCHABLE_TEXT_FIELDS = [
  'name',
  'employeeId',
  'department',
  'currentGrade',
  'promoteGrade',
  'periodeName',
  'type',
  'presentation',
  'status',
  'remark',
]

export const getSummaries = async (req, res) => {
  try {
    const {
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const where = {}
    const term = String(search).trim()

    if (term) {
      const like = { [Op.like]: `%${term}%` }
      const conditions = SEARCHABLE_TEXT_FIELDS.map((field) => ({ [field]: like }))

      // FY is stored as a number but shown as "FY2026", so "FY2026" and "2026" both match.
      const fiscalYearTerm = term.replace(/^fy/i, '')
      if (fiscalYearTerm) {
        conditions.push(
          sequelize.where(sequelize.cast(sequelize.col('fiscalYear'), 'NVARCHAR(10)'), {
            [Op.like]: `%${fiscalYearTerm}%`,
          })
        )
      }

      where[Op.or] = conditions
    }

    const { rows, count } = await PromotionSummary.findAndCountAll({
      where,
      order: [
        [sortField, sortDirection],
        ['id', 'ASC'],
      ],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    })

    return res.status(200).json({
      summaries: rows,
      total: count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(count / pageSize), 1),
    })
  } catch (error) {
    console.error('Get summaries error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// The logged-in employee's own promotion history (My Promotion > Promotion History).
// "Pending 6 Month" rows are left out: that promotion continues in the next period.
export const getMySummaries = async (req, res) => {
  try {
    const summaries = await PromotionSummary.findAll({
      where: { employeeId: req.user.employeeId, status: { [Op.ne]: 'Pending 6 Month' } },
      attributes: [
        'id',
        'fiscalYear',
        'periodeName',
        'currentGrade',
        'promoteGrade',
        'type',
        'presentation',
        'status',
        'remark',
        'createdAt',
      ],
      order: [
        ['fiscalYear', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    })
    return res.status(200).json({ summaries })
  } catch (error) {
    console.error('Get my summaries error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// A manual entry is always type PTC, without a presentation, and recommended.
export const MANUAL_SUMMARY = { type: 'PTC', presentation: 'NO', status: 'Recommended' }
const GRADE_TITLES = GRADES.map((grade) => grade.title)

// Admin adds someone to the summary by hand (type PTC, recommended), skipping every approval
// (eligibility, submission, presentation). Their promotion record in that period is created or
// updated and marked summarized, and any approval still waiting for them there is dropped.
export const addManualSummary = async (req, res) => {
  try {
    const { employeeId, periodeId, currentGrade, promoteGrade, remark = '' } = req.body

    const [employee, periode] = await Promise.all([
      Employee.findOne({ where: { employeeId: String(employeeId || ''), isActive: true } }),
      Periode.findByPk(periodeId),
    ])
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found or inactive' })
    }
    if (!periode) {
      return res.status(404).json({ message: 'Please choose a period' })
    }
    if (!GRADE_TITLES.includes(currentGrade) || !GRADE_TITLES.includes(promoteGrade)) {
      return res.status(400).json({ message: 'Please choose the current and promote grade' })
    }
    if (GRADE_TITLES.indexOf(promoteGrade) <= GRADE_TITLES.indexOf(currentGrade)) {
      return res.status(400).json({ message: 'Promote grade must be higher than the current grade' })
    }

    const existingSummary = await PromotionSummary.findOne({
      where: { employeeId: employee.employeeId, periodeId: periode.id },
    })
    if (existingSummary) {
      const message = `${employee.name} is already in the summary for ${periode.name} (status ${existingSummary.status})`
      return res.status(409).json({ message })
    }

    const fields = {
      name: employee.name,
      department: employee.department,
      currentGrade,
      promoteGrade,
      type: MANUAL_SUMMARY.type,
      presentation: MANUAL_SUMMARY.presentation,
      remark: String(remark).trim().slice(0, 500),
    }

    await sequelize.transaction(async (transaction) => {
      const [promotion, created] = await EmployeePromotion.findOrCreate({
        where: { employeeId: employee.employeeId, periodeId: periode.id },
        defaults: fields,
        transaction,
      })
      if (!created) await promotion.update(fields, { transaction })

      await PromotionRequest.destroy({
        where: {
          employeeId: employee.employeeId,
          periodeId: periode.id,
          status: { [Op.in]: ['pending_superior', 'pending_hod'] },
        },
        transaction,
      })

      await addToSummary({ promotion, periode, status: MANUAL_SUMMARY.status, remark: fields.remark, transaction })
    })

    // Notification 10 (config/notificationTemplates.js).
    notify('manualSummaryPtc', {
      employeeId: employee.employeeId,
      periode,
      actorId: req.user.employeeId,
      vars: { remark: fields.remark },
    })

    return res.status(201).json({ message: `${employee.name} added to the summary (PTC, ${MANUAL_SUMMARY.status})` })
  } catch (error) {
    console.error('Add manual summary error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
