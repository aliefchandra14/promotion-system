import { Op } from 'sequelize'
import { Periode, Employee } from '../models/index.js'
import { sendPeriodActivationEmail } from '../services/emailService.js'

const SORTABLE_FIELDS = ['name', 'startDate', 'endDate', 'status', 'createdAt']

export const getPeriodes = async (req, res) => {
  try {
    const {
      search = '',
      status = '',
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
    const { name, startDate, endDate } = req.body

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: 'Name, start date, and end date are required' })
    }

    const periode = await Periode.create({ name, startDate, endDate, status: 'draft' })

    return res.status(201).json({ message: 'Period created', periode })
  } catch (error) {
    console.error('Create periode error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const activatePeriode = async (req, res) => {
  try {
    const { id } = req.params
    const exists = await Periode.findByPk(id)

    if (!exists) {
      return res.status(404).json({ message: 'Period not found' })
    }

    await Periode.update({ status: 'completed' }, { where: { status: 'active', id: { [Op.ne]: id } } })
    await Periode.update({ status: 'active' }, { where: { id } })
    const periode = await Periode.findByPk(id)

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
