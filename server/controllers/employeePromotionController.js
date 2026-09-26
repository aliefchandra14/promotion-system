import { Op } from 'sequelize'
import ExcelJS from 'exceljs'
import { Employee, Periode, EmployeePromotion, PromotionRequest } from '../models/index.js'
import { parseWorkbookRows, pickField } from '../utils/excelImport.js'
import { GRADES } from '../constants/grades.js'

const SORTABLE_FIELDS = [
  'employeeId',
  'name',
  'department',
  'currentGrade',
  'promoteGrade',
  'type',
  'toeic',
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
      include: [
        {
          association: 'employee',
          attributes: ['employeeId', 'email', 'trainer', 'superior', 'hod'],
          include: [
            { association: 'trainerInfo', attributes: ['employeeId', 'name'] },
            { association: 'superiorInfo', attributes: ['employeeId', 'name'] },
            { association: 'hodInfo', attributes: ['employeeId', 'name'] },
          ],
        },
      ],
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
  promoteGrade: ['promote to', 'promoteto', 'promotegrade', 'promote grade'],
  presentation: ['presentation'],
  type: ['type'],
  toeic: ['toeic'],
  remark: ['remark'],
}

export const importEmployeePromotions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' })
    }

    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res.status(400).json({
        message: 'Please create and activate a promotion period before importing data',
      })
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
        const toeicRaw = pickField(values, HEADER_ALIASES.toeic)
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

        let toeic = null
        if (toeicRaw) {
          toeic = Number(toeicRaw)
          if (Number.isNaN(toeic)) {
            throw new Error('toeic must be a number')
          }
        }

        const payload = { name, department, currentGrade, promoteGrade, type, presentation, toeic, remark }
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

        if (employeeExists.superior) {
          await PromotionRequest.findOrCreate({
            where: { employeeId, periodeId: periode.id, type: 'eligibility' },
            defaults: { status: 'pending_superior' },
          })
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

const TEMPLATE_ROW_LIMIT = 40

const getNextGrade = (gradeTitle) => {
  const index = GRADES.findIndex((grade) => grade.title === gradeTitle)
  return index >= 0 ? GRADES[index + 1] ?? null : null
}

// Rows come from the real employees table so every employeeId in the template is importable.
// Employees who can still be promoted (their grade has a next step) are listed first.
const buildTemplateRows = (employees) => {
  const promotable = employees.filter((emp) => getNextGrade(emp.grade))
  const others = employees.filter((emp) => !getNextGrade(emp.grade))

  return [...promotable, ...others].slice(0, TEMPLATE_ROW_LIMIT).map((emp, index) => {
    const no = index + 1
    const nextGrade = getNextGrade(emp.grade)

    return {
      no,
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department ?? '',
      currentGrade: emp.grade ?? '',
      promoteGrade: nextGrade?.title ?? '',
      presentation: no % 2 === 0 ? 'YES' : 'NO',
      type: no % 3 === 0 ? 'SPECIAL' : 'NORMAL',
      toeic: nextGrade?.toeic ? 500 + ((no * 17) % 400) : null,
      remark: '',
    }
  })
}

export const downloadEmployeePromotionTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Employee Promotions')

    const headers = [
      'No.',
      'Employee ID',
      'Name',
      'Department',
      'Current Grade',
      'Promote To',
      'Presentation',
      'Type',
      'TOEIC',
      'Remark',
    ]
    const headerRow = worksheet.getRow(1)
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header
    })
    headerRow.font = { bold: true }

    worksheet.columns = headers.map(() => ({ width: 18 }))

    const employees = await Employee.findAll({
      where: { role: 'employee', isActive: true },
      attributes: ['employeeId', 'name', 'department', 'grade'],
      order: [['employeeId', 'ASC']],
      raw: true,
    })

    buildTemplateRows(employees).forEach((row, index) => {
      const excelRow = worksheet.getRow(2 + index)
      excelRow.getCell(1).value = row.no
      excelRow.getCell(2).value = row.employeeId
      excelRow.getCell(3).value = row.name
      excelRow.getCell(4).value = row.department
      excelRow.getCell(5).value = row.currentGrade
      excelRow.getCell(6).value = row.promoteGrade
      excelRow.getCell(7).value = row.presentation
      excelRow.getCell(8).value = row.type
      excelRow.getCell(9).value = row.toeic
      excelRow.getCell(10).value = row.remark
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="employee-promotion-import-template.xlsx"'
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Download employee promotion template error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const updateEmployeePromotion = async (req, res) => {
  try {
    const { id } = req.params
    const { department, currentGrade, promoteGrade, type, toeic, presentation, status, remark } = req.body

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
    if (toeic !== undefined && toeic !== null && toeic !== '' && Number.isNaN(Number(toeic))) {
      return res.status(400).json({ message: 'TOEIC must be a number' })
    }

    const updates = {}
    if (department !== undefined) updates.department = department || null
    if (currentGrade !== undefined) updates.currentGrade = currentGrade || null
    if (promoteGrade !== undefined) updates.promoteGrade = promoteGrade || null
    if (type !== undefined) updates.type = type || null
    if (toeic !== undefined) updates.toeic = toeic === '' || toeic === null ? null : Number(toeic)
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
