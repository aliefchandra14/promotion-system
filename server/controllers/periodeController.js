import { Op } from 'sequelize'
import { Periode, Employee } from '../models/index.js'
import { sendPeriodActivationEmail } from '../services/emailService.js'
import { sendNotificationToMany } from '../services/notificationService.js'
import { ensureFiscalYearPeriods } from '../services/periodeService.js'

const SORTABLE_FIELDS = ['name', 'fiscalYear', 'startDate', 'endDate', 'status', 'createdAt']

export const getPeriodes = async (req, res) => {
  try {
    // A new fiscal year gets its Periode 1 & 2 the first time the list is opened.
    await ensureFiscalYearPeriods()

    const {
      search = '',
      status = '',
      fiscalYear = '',
      sortBy = 'name',
      sortOrder = 'ASC',
      page = '1',
      limit = '10',
    } = req.query

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name'
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

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

// Periods themselves are fixed (Periode 1 & 2 per fiscal year); admin can only change their dates.
export const updatePeriodeDates = async (req, res) => {
  try {
    const periode = await Periode.findByPk(req.params.id)
    if (!periode) {
      return res.status(404).json({ message: 'Period not found' })
    }

    const { startDate, endDate } = req.body
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({ message: 'Start and end dates are required and must be valid dates' })
    }
    if (startDate > endDate) {
      return res.status(400).json({ message: 'The end date cannot be before the start date' })
    }

    await periode.update({ startDate, endDate })
    return res.status(200).json({ message: `${periode.name} dates updated`, periode })
  } catch (error) {
    console.error('Update periode dates error:', error)
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

    const employees = await Employee.findAll({
      where: { role: 'employee', isActive: true },
      attributes: ['employeeId'],
      raw: true,
    })
    // Notification 1 (config/notificationTemplates.js): one email per active employee.
    const counts = await sendNotificationToMany(
      'periodReminder',
      employees.map((employee) => employee.employeeId),
      { periode }
    )

    const parts = []
    if (counts.sent) parts.push(`sent to ${counts.sent} employee(s)`)
    if (counts.simulated) parts.push(`${counts.simulated} logged only (email is off: dev mode or SMTP not set)`)
    if (counts.skipped) parts.push(`${counts.skipped} skipped (no email address, or the template is disabled)`)
    if (counts.failed) parts.push(`${counts.failed} failed`)
    return res.status(200).json({ message: `Reminder: ${parts.join(', ') || 'no employees to notify'}` })
  } catch (error) {
    console.error('Send period reminder error:', error)
    return res.status(500).json({ message: 'Failed to send reminder email' })
  }
}
