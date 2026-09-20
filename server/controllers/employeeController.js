import { Op } from 'sequelize'
import { Employee, EmployeeJudge } from '../models/index.js'
import { parseWorkbookRows, pickField } from '../utils/excelImport.js'

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
  employeeId: ['employeeid', 'employee id', 'employee'],
  name: ['name'],
  department: ['department', 'departme'],
  email: ['email'],
  trainer: ['trainer'],
  superior: ['superior'],
  hod: ['hod'],
  isChange: ['ischange', 'is change'],
  password: ['password'],
}

export const importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' })
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
        const password = pickField(values, HEADER_ALIASES.password)
        const department = pickField(values, HEADER_ALIASES.department) || null
        const email = pickField(values, HEADER_ALIASES.email) || null
        const trainer = pickField(values, HEADER_ALIASES.trainer) || null
        const superior = pickField(values, HEADER_ALIASES.superior) || null
        const hod = pickField(values, HEADER_ALIASES.hod) || null
        const isChangeRaw = pickField(values, HEADER_ALIASES.isChange).toLowerCase()
        const isChange = ['1', 'true', 'yes'].includes(isChangeRaw) ? 1 : 0

        if (!/^[0-9]{6}$/.test(employeeId)) {
          throw new Error('employeeId must be a 6-digit number')
        }
        if (!name) {
          throw new Error('name is required')
        }
        if (!password) {
          throw new Error('password is required')
        }

        const payload = { name, department, email, trainer, superior, hod, isChange, password }
        const existing = await Employee.findOne({ where: { employeeId } })

        if (existing) {
          await existing.update(payload)
          results.updated += 1
        } else {
          await Employee.create({ employeeId, ...payload })
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

const RELATION_ID_PATTERN = /^[0-9]{6}$/

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
