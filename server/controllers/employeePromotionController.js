import { Op } from 'sequelize'
import { Employee, Periode, EmployeePromotion } from '../models/index.js'
import { parseWorkbookRows, pickField } from '../utils/excelImport.js'

const SORTABLE_FIELDS = [
  'employeeId',
  'name',
  'department',
  'currentGrade',
  'promoteGrade',
  'type',
  'presentation',
  'status',
  'createdAt',
]

const PRESENTATION_VALUES = ['YES', 'NO']
const STATUS_VALUES = ['NORMAL', 'SPECIAL']

const resolveWorkingPeriode = async () => {
  const active = await Periode.findOne({ where: { status: 'active' } })
  if (active) return active
  return Periode.findOne({ order: [['createdAt', 'DESC']] })
}

export const getEmployeePromotions = async (req, res) => {
  try {
    const periode = await resolveWorkingPeriode()

    if (!periode) {
      return res.status(200).json({
        promotions: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        periode: null,
      })
    }

    const {
      search = '',
      department = '',
      status = '',
      presentation = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const where = { periodeId: periode.id }

    if (search) {
      where[Op.or] = [
        { employeeId: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
      ]
    }

    if (department) where.department = department
    if (STATUS_VALUES.includes(status)) where.status = status
    if (PRESENTATION_VALUES.includes(presentation)) where.presentation = presentation

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const { rows, count } = await EmployeePromotion.findAndCountAll({
      where,
      order: [[sortField, sortDirection]],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    })

    return res.status(200).json({
      promotions: rows,
      total: count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(count / pageSize), 1),
      periode,
    })
  } catch (error) {
    console.error('Get employee promotions error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

const HEADER_ALIASES = {
  employeeId: ['employeeid', 'employee id', 'employee'],
  name: ['name'],
  department: ['department'],
  currentGrade: ['currentgrade', 'current grade'],
  promoteGrade: ['promotegrade', 'promote grade'],
  type: ['type'],
  presentation: ['presentation'],
  status: ['status'],
  remark: ['remark'],
}

export const importEmployeePromotions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' })
    }

    const periode = await resolveWorkingPeriode()
    if (!periode) {
      return res.status(400).json({ message: 'Please create a promotion period first' })
    }

    const rows = await parseWorkbookRows(req.file.buffer)

    if (rows.length === 0) {
      return res.status(400).json({ message: 'The Excel file has no data' })
    }

    const results = { created: 0, updated: 0, failed: 0, errors: [] }

    for (const { rowNumber, values } of rows) {
      try {
        const employeeId = pickField(values, HEADER_ALIASES.employeeId)
        const name = pickField(values, HEADER_ALIASES.name)
        const department = pickField(values, HEADER_ALIASES.department) || null
        const currentGrade = pickField(values, HEADER_ALIASES.currentGrade) || null
        const promoteGrade = pickField(values, HEADER_ALIASES.promoteGrade) || null
        const type = pickField(values, HEADER_ALIASES.type) || null
        const presentationRaw = pickField(values, HEADER_ALIASES.presentation).toUpperCase()
        const statusRaw = pickField(values, HEADER_ALIASES.status).toUpperCase()
        const remark = pickField(values, HEADER_ALIASES.remark) || ''

        if (!/^[0-9]{6}$/.test(employeeId)) {
          throw new Error('employeeId must be a 6-digit number')
        }
        if (!name) {
          throw new Error('name is required')
        }

        const employeeExists = await Employee.findOne({ where: { employeeId } })
        if (!employeeExists) {
          throw new Error('employeeId not found in employee master data')
        }

        const presentation = PRESENTATION_VALUES.includes(presentationRaw) ? presentationRaw : 'NO'
        const status = STATUS_VALUES.includes(statusRaw) ? statusRaw : 'NORMAL'

        const payload = { name, department, currentGrade, promoteGrade, type, presentation, status, remark }
        const existing = await EmployeePromotion.findOne({
          where: { employeeId, periodeId: periode.id },
        })

        if (existing) {
          await existing.update(payload)
          results.updated += 1
        } else {
          await EmployeePromotion.create({ employeeId, periodeId: periode.id, ...payload })
          results.created += 1
        }
      } catch (error) {
        results.failed += 1
        results.errors.push(`Row ${rowNumber}: ${error.message}`)
      }
    }

    const errors = results.errors.slice(0, 20)

    return res.status(200).json({
      message: `Import finished: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
      errors,
      hasMoreErrors: results.errors.length > errors.length,
    })
  } catch (error) {
    console.error('Import employee promotions error:', error)
    return res.status(500).json({ message: error.message || 'Something went wrong on the server' })
  }
}

export const updateEmployeePromotion = async (req, res) => {
  try {
    const { id } = req.params
    const { department, currentGrade, promoteGrade, type, presentation, status, remark } = req.body

    const record = await EmployeePromotion.findByPk(id)
    if (!record) {
      return res.status(404).json({ message: 'Promotion record not found' })
    }

    if (presentation !== undefined && !PRESENTATION_VALUES.includes(presentation)) {
      return res.status(400).json({ message: 'Presentation must be YES or NO' })
    }
    if (status !== undefined && !STATUS_VALUES.includes(status)) {
      return res.status(400).json({ message: 'Status must be NORMAL or SPECIAL' })
    }

    const updates = {}
    if (department !== undefined) updates.department = department || null
    if (currentGrade !== undefined) updates.currentGrade = currentGrade || null
    if (promoteGrade !== undefined) updates.promoteGrade = promoteGrade || null
    if (type !== undefined) updates.type = type || null
    if (presentation !== undefined) updates.presentation = presentation
    if (status !== undefined) updates.status = status
    if (remark !== undefined) updates.remark = remark || ''

    await record.update(updates)

    return res.status(200).json({ message: 'Promotion record updated', promotion: record })
  } catch (error) {
    console.error('Update employee promotion error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
