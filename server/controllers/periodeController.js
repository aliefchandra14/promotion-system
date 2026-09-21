import { Op } from 'sequelize'
import { Periode, Employee, PromotionRequest, EmployeePromotion } from '../models/index.js'
import { sendPeriodActivationEmail, sendPeriodReminderEmail } from '../services/emailService.js'
import { getFiscalYear } from '../constants/fiscalYear.js'

const SORTABLE_FIELDS = ['name', 'fiscalYear', 'startDate', 'endDate', 'status', 'createdAt']

export const getPeriodes = async (req, res) => {
  try {
    const {
      search = '',
      status = '',
      fiscalYear = '',
      sortBy = 'startDate',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'startDate'
    const sortDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const where = {}

    if (search) {
      where.name = { [Op.like]: `%${search}%` }
    }

    if (status) {
      where.status = status
    }

    if (fiscalYear) {
      where.fiscalYear = fiscalYear
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const { rows, count } = await Periode.findAndCountAll({
      where,
      order: [[sortField, sortDirection]],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    })

    return res.status(200).json({
      periodes: rows,
      total: count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(count / pageSize), 1),
    })
  } catch (error) {
    console.error('Get periodes error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const createPeriode = async (req, res) => {
  try {
    const { name, startDate, endDate, fiscalYear } = req.body

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: 'Name, start date, and end date are required' })
    }

    const resolvedFiscalYear = fiscalYear ? Number(fiscalYear) : getFiscalYear(startDate)

    if (!Number.isInteger(resolvedFiscalYear)) {
      return res.status(400).json({ message: 'Fiscal year must be a valid year' })
    }

    const periode = await Periode.create({
      name,
      fiscalYear: resolvedFiscalYear,
      startDate,
      endDate,
      status: 'draft',
    })

    return res.status(201).json({ message: 'Period created', periode })
  } catch (error) {
    console.error('Create periode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const activatePeriode = async (req, res) => {
  try {
    const { id } = req.params
    const periode = await Periode.findByPk(id)

    if (!periode) {
      return res.status(404).json({ message: 'Period not found' })
    }

    const conflictingPeriode = await Periode.findOne({
      where: { status: 'active', id: { [Op.ne]: id } },
    })

    if (conflictingPeriode) {
      return res.status(409).json({
        message: `Please deactivate "${conflictingPeriode.name}" before activating this period`,
      })
    }

    await periode.update({ status: 'active' })

    const employees = await Employee.findAll({ where: { role: 'employee', isActive: true } })
    sendPeriodActivationEmail(periode, employees).catch((error) =>
      console.error('Failed to send period activation email:', error)
    )

    return res.status(200).json({ message: 'Period activated', periode })
  } catch (error) {
    console.error('Activate periode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const deactivatePeriode = async (req, res) => {
  try {
    const { id } = req.params
    const periode = await Periode.findByPk(id)

    if (!periode) {
      return res.status(404).json({ message: 'Period not found' })
    }

    if (periode.status !== 'active') {
      return res.status(400).json({ message: 'This period is not active' })
    }

    await periode.update({ status: 'draft' })

    return res.status(200).json({ message: 'Period deactivated', periode })
  } catch (error) {
    console.error('Deactivate periode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const deletePeriode = async (req, res) => {
  try {
    const { id } = req.params
    const periode = await Periode.findByPk(id)

    if (!periode) {
      return res.status(404).json({ message: 'Period not found' })
    }

    if (periode.status === 'active') {
      return res.status(400).json({ message: 'Please deactivate this period before deleting it' })
    }

    const [requestCount, promotionCount] = await Promise.all([
      PromotionRequest.count({ where: { periodeId: id } }),
      EmployeePromotion.count({ where: { periodeId: id } }),
    ])

    if (requestCount > 0 || promotionCount > 0) {
      return res.status(409).json({
        message: 'This period already has promotion records and cannot be deleted',
      })
    }

    await periode.destroy()

    return res.status(200).json({ message: 'Period deleted' })
  } catch (error) {
    console.error('Delete periode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const sendPeriodReminder = async (req, res) => {
  try {
    const { id } = req.params
    const periode = await Periode.findByPk(id)

    if (!periode) {
      return res.status(404).json({ message: 'Period not found' })
    }

    if (periode.status !== 'active') {
      return res.status(400).json({ message: 'Reminder can only be sent for an active period' })
    }

    const employees = await Employee.findAll({ where: { role: 'employee', isActive: true } })
    const result = await sendPeriodReminderEmail(periode, employees)

    if (result.sent === 0) {
      return res.status(200).json({ message: 'No employee email addresses were found to notify' })
    }

    return res.status(200).json({
      message: result.simulated
        ? `Reminder logged for ${result.sent} employee(s) (SMTP is not configured yet)`
        : `Reminder sent to ${result.sent} employee(s)`,
    })
  } catch (error) {
    console.error('Send period reminder error:', error)
    return res.status(500).json({ message: 'Failed to send reminder email' })
  }
}
