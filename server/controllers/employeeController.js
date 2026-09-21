import { Op } from 'sequelize'
import ExcelJS from 'exceljs'
import { Employee, EmployeeJudge } from '../models/index.js'
import { parseWorkbookRows, pickField, pickRawField } from '../utils/excelImport.js'
import { DEPARTMENTS } from '../constants/departments.js'
import { GRADES } from '../constants/grades.js'

const SORTABLE_FIELDS = ['employeeId', 'name', 'department', 'email', 'grade', 'role', 'isActive', 'createdAt']

export const getEmployees = async (req, res) => {
  try {
    const {
      search = '',
      department = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const where = {}

    if (search) {
      where[Op.or] = [
        { employeeId: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ]
    }

    if (department) {
      where.department = department
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const { rows, count } = await Employee.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [[sortField, sortDirection]],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    })

    return res.status(200).json({
      employees: rows,
      total: count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(count / pageSize), 1),
    })
  } catch (error) {
    console.error('Get employees error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

const HEADER_ALIASES = {
  employeeId: ['employee no.', 'employee no', 'employeeid', 'employee id', 'employee'],
  name: ['employee name', 'name'],
  department: ['department', 'departme'],
  email: ['alamat email', 'email'],
  grade: ['job grade', 'grade'],
  sectionName: ['section name', 'section'],
  joinDate: ['join date', 'joindate'],
  trainer: ['trainer'],
  superior: ['superior'],
  hod: ['hod'],
}

const RELATION_ID_PATTERN = /^[0-9]{6}$/

const IMPORT_HEADER_ROW = 3
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

const parseJoinDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    return new Date(EXCEL_EPOCH + value * 86400000)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' })
    }

    const rows = await parseWorkbookRows(req.file.buffer, { headerRow: IMPORT_HEADER_ROW })

    if (rows.length === 0) {
      return res.status(400).json({ message: 'The Excel file has no data' })
    }

    const results = { created: 0, updated: 0, failed: 0, errors: [] }

    for (const { rowNumber, values, raw } of rows) {
      try {
        const employeeId = pickField(values, HEADER_ALIASES.employeeId)
        const name = pickField(values, HEADER_ALIASES.name)
        const department = pickField(values, HEADER_ALIASES.department) || null
        const email = pickField(values, HEADER_ALIASES.email) || null
        const grade = pickField(values, HEADER_ALIASES.grade) || null
        const sectionName = pickField(values, HEADER_ALIASES.sectionName) || null
        const joinDate = parseJoinDate(pickRawField(values, raw, HEADER_ALIASES.joinDate))
        const trainer = pickField(values, HEADER_ALIASES.trainer) || null
        const superior = pickField(values, HEADER_ALIASES.superior) || null
        const hod = pickField(values, HEADER_ALIASES.hod) || null

        if (!/^[0-9]{6}$/.test(employeeId)) {
          throw new Error('Employee No. must be a 6-digit number')
        }
        if (!name) {
          throw new Error('Employee Name is required')
        }
        for (const [field, value] of [['Trainer', trainer], ['Superior', superior], ['HOD', hod]]) {
          if (value && !RELATION_ID_PATTERN.test(value)) {
            throw new Error(`${field} must be a 6-digit employee ID`)
          }
        }

        const payload = { name, department, email, grade, sectionName, joinDate, trainer, superior, hod }
        const existing = await Employee.findOne({ where: { employeeId } })

        if (existing) {
          await existing.update(payload)
          results.updated += 1
        } else {
          await Employee.create({ employeeId, ...payload, password: employeeId, isChange: 0 })
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
    console.error('Import employees error:', error)
    return res.status(500).json({ message: error.message || 'Something went wrong on the server' })
  }
}

const SAMPLE_FIRST_NAMES = [
  'Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hendra', 'Indah', 'Joko',
  'Kiki', 'Lina', 'Made', 'Nia', 'Oscar', 'Putra', 'Qori', 'Rina', 'Sari', 'Tono',
]
const SAMPLE_LAST_NAMES = [
  'Saputra', 'Wijaya', 'Kusuma', 'Pratama', 'Hidayat', 'Santoso', 'Wardani', 'Setiawan', 'Utami', 'Firmansyah',
  'Nugroho',
]

const SAMPLE_HOD_IDS = ['900001', '900002']
const SAMPLE_SUPERIOR_IDS = ['900003', '900004', '900005', '900006', '900007', '900008']
const SAMPLE_SUPERIOR_TO_HOD = {
  900003: '900001',
  900004: '900001',
  900005: '900001',
  900006: '900002',
  900007: '900002',
  900008: '900002',
}

const buildSampleRows = (count) => {
  const rows = []
  for (let i = 1; i <= count; i += 1) {
    const employeeId = String(900000 + i).padStart(6, '0')
    const firstName = SAMPLE_FIRST_NAMES[(i - 1) % SAMPLE_FIRST_NAMES.length]
    const lastName = SAMPLE_LAST_NAMES[(i - 1) % SAMPLE_LAST_NAMES.length]
    const department = DEPARTMENTS[(i - 1) % DEPARTMENTS.length]
    const grade = GRADES[(i - 1) % GRADES.length].title

    let trainer = null
    let superior = null
    let hod = null

    if (SAMPLE_HOD_IDS.includes(employeeId)) {
      // top of the sample hierarchy, no superior/hod of their own
    } else if (SAMPLE_SUPERIOR_IDS.includes(employeeId)) {
      hod = SAMPLE_SUPERIOR_TO_HOD[employeeId]
    } else {
      const assignedSuperior = SAMPLE_SUPERIOR_IDS[(i - 1) % SAMPLE_SUPERIOR_IDS.length]
      superior = assignedSuperior
      hod = SAMPLE_SUPERIOR_TO_HOD[assignedSuperior]
      trainer = assignedSuperior
    }

    rows.push({
      no: i,
      employeeId,
      name: `${firstName} ${lastName}`,
      department,
      email: `${firstName}.${lastName}${i}@company.com`.toLowerCase(),
      grade,
      sectionName: `${department} Section`,
      joinDate: new Date(2020, (i - 1) % 12, ((i - 1) % 27) + 1),
      trainer,
      superior,
      hod,
    })
  }
  return rows
}

export const downloadEmployeeTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Employees')

    worksheet.getCell('A1').value = 'Employee Import Template'
    worksheet.getRow(1).font = { bold: true }

    const headers = [
      'No.',
      'Employee No.',
      'Employee Name',
      'Department',
      'Alamat Email',
      'Job Grade',
      'Section Name',
      'Join Date',
      'Trainer',
      'Superior',
      'HOD',
    ]
    const headerRow = worksheet.getRow(3)
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header
    })
    headerRow.font = { bold: true }

    worksheet.columns = headers.map(() => ({ width: 20 }))

    buildSampleRows(40).forEach((row, index) => {
      const excelRow = worksheet.getRow(4 + index)
      excelRow.getCell(1).value = row.no
      excelRow.getCell(2).value = row.employeeId
      excelRow.getCell(3).value = row.name
      excelRow.getCell(4).value = row.department
      excelRow.getCell(5).value = row.email
      excelRow.getCell(6).value = row.grade
      excelRow.getCell(7).value = row.sectionName
      const dateCell = excelRow.getCell(8)
      dateCell.value = row.joinDate
      dateCell.numFmt = 'dd/mm/yyyy'
      excelRow.getCell(9).value = row.trainer
      excelRow.getCell(10).value = row.superior
      excelRow.getCell(11).value = row.hod
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', 'attachment; filename="employee-import-template.xlsx"')

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Download employee template error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params
    const { name, email, department, grade, trainer, superior, hod, isActive } = req.body

    const employee = await Employee.findOne({ where: { employeeId } })

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' })
    }

    for (const [field, value] of [['trainer', trainer], ['superior', superior], ['hod', hod]]) {
      if (value && !RELATION_ID_PATTERN.test(value)) {
        return res.status(400).json({ message: `${field} must be a 6-digit employee ID` })
      }
    }

    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email || null
    if (department !== undefined) updates.department = department || null
    if (grade !== undefined) updates.grade = grade || null
    if (trainer !== undefined) updates.trainer = trainer || null
    if (superior !== undefined) updates.superior = superior || null
    if (hod !== undefined) updates.hod = hod || null
    if (isActive !== undefined) updates.isActive = isActive

    await employee.update(updates)
    const { password: _password, ...employeeWithoutPassword } = employee.toJSON()

    return res.status(200).json({ message: 'Employee updated', employee: employeeWithoutPassword })
  } catch (error) {
    console.error('Update employee error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const getEmployeeJudges = async (req, res) => {
  try {
    const { employeeId } = req.params
    const links = await EmployeeJudge.findAll({ where: { employeeId } })
    const judgeIds = links.map((link) => link.judgeId)

    const judges = judgeIds.length
      ? await Employee.findAll({
          where: { employeeId: judgeIds },
          attributes: ['employeeId', 'name', 'department'],
        })
      : []

    return res.status(200).json({ judges })
  } catch (error) {
    console.error('Get employee judges error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const addEmployeeJudge = async (req, res) => {
  try {
    const { employeeId } = req.params
    const { judgeId } = req.body

    if (!judgeId || !RELATION_ID_PATTERN.test(judgeId)) {
      return res.status(400).json({ message: 'A valid 6-digit judge employee ID is required' })
    }

    if (judgeId === employeeId) {
      return res.status(400).json({ message: 'An employee cannot be their own judge' })
    }

    const judgeExists = await Employee.findOne({ where: { employeeId: judgeId } })
    if (!judgeExists) {
      return res.status(404).json({ message: 'Judge employee ID not found' })
    }

    const [, created] = await EmployeeJudge.findOrCreate({ where: { employeeId, judgeId } })

    if (!created) {
      return res.status(409).json({ message: 'This employee is already assigned as a judge' })
    }

    return res.status(201).json({ message: 'Judge added' })
  } catch (error) {
    console.error('Add employee judge error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const removeEmployeeJudge = async (req, res) => {
  try {
    const { employeeId, judgeId } = req.params
    await EmployeeJudge.destroy({ where: { employeeId, judgeId } })
    return res.status(200).json({ message: 'Judge removed' })
  } catch (error) {
    console.error('Remove employee judge error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
