import { Op } from 'sequelize'
import { sequelize, PromotionSummary } from '../models/index.js'

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
