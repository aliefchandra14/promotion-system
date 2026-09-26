import { Op } from 'sequelize'
import { Periode, PromotionPresentation, PresentationReminderLog } from '../models/index.js'
import { GRADES } from '../constants/grades.js'
import { todayString, closeExpiredPresentations } from '../services/presentationService.js'

const PROJECT_GRADES = GRADES.filter((grade) => grade.project).map((grade) => grade.title)

const SORTABLE_FIELDS = [
  'grade',
  'briefingStart',
  'submissionStart',
  'presentationStart',
  'isOpen',
  'createdAt',
]

const DATE_PAIRS = [
  ['briefingStart', 'briefingEnd', 'Briefing'],
  ['submissionStart', 'submissionEnd', 'Submission'],
  ['presentationStart', 'presentationEnd', 'Presentation'],
]

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

// Returns an error message, or null when the dates are all present, valid and start <= end.
const validateDates = (body) => {
  for (const [startKey, endKey, label] of DATE_PAIRS) {
    const start = body[startKey]
    const end = body[endKey]

    if (!isValidDate(start) || !isValidDate(end)) {
      return `${label} start and end dates are required and must be valid dates`
    }
    if (start > end) {
      return `${label} end date cannot be before its start date`
    }
  }
  return null
}

// Start dates cannot be in the past. When editing, a start date that is left unchanged is always
// accepted, so an ongoing presentation can still be updated after its start date has passed.
const validateStartDates = (body, existing = null) => {
  const today = todayString()
  for (const [startKey, , label] of DATE_PAIRS) {
    const unchanged = existing && existing[startKey] === body[startKey]
    if (!unchanged && body[startKey] < today) {
      return `${label} start date cannot be in the past`
    }
  }
  return null
}

const pickDates = (body) => {
  const dates = {}
  for (const [startKey, endKey] of DATE_PAIRS) {
    dates[startKey] = body[startKey]
    dates[endKey] = body[endKey]
  }
  return dates
}

export const getPresentations = async (req, res) => {
  try {
    await closeExpiredPresentations()

    const {
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = '1',
      limit = '10',
    } = req.query

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res
        .status(200)
        .json({ presentations: [], total: 0, page: pageNumber, limit: pageSize, totalPages: 1, periode: null })
    }

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const where = { periodeId: periode.id }
    const term = String(search).trim()
    if (term) {
      where.grade = { [Op.like]: `%${term}%` }
    }

    const { rows, count } = await PromotionPresentation.findAndCountAll({
      where,
      order: [
        [sortField, sortDirection],
        ['id', 'ASC'],
      ],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    })

    // When each reminder (briefing / submission / presentation) was last sent for these rows.
    const logs = rows.length
      ? await PresentationReminderLog.findAll({
          where: { presentationId: rows.map((row) => row.id) },
          order: [['createdAt', 'DESC']],
        })
      : []
    const lastSent = new Map()
    for (const log of logs) {
      const key = `${log.presentationId}:${log.type}`
      if (!lastSent.has(key)) {
        lastSent.set(key, { sentAt: log.createdAt, sentCount: log.sentCount, simulated: log.simulated })
      }
    }
    const presentations = rows.map((row) => ({
      ...row.toJSON(),
      reminders: {
        briefing: lastSent.get(`${row.id}:briefing`) || null,
        submission: lastSent.get(`${row.id}:submission`) || null,
        presentation: lastSent.get(`${row.id}:presentation`) || null,
      },
    }))

    return res.status(200).json({
      presentations,
      total: count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(count / pageSize), 1),
      periode,
    })
  } catch (error) {
    console.error('Get presentations error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const createPresentation = async (req, res) => {
  try {
    const { grade, isOpen } = req.body

    if (!PROJECT_GRADES.includes(grade)) {
      return res.status(400).json({ message: 'Please choose a grade that requires a project' })
    }

    const dateError = validateDates(req.body)
    if (dateError) {
      return res.status(400).json({ message: dateError })
    }

    const pastError = validateStartDates(req.body)
    if (pastError) {
      return res.status(400).json({ message: pastError })
    }

    const periode = await Periode.findOne({ where: { status: 'active' } })
    if (!periode) {
      return res.status(400).json({ message: 'Please activate a promotion period first' })
    }

    const existing = await PromotionPresentation.findOne({ where: { periodeId: periode.id, grade } })
    if (existing) {
      return res.status(409).json({ message: `A presentation for ${grade} already exists in this period` })
    }

    const presentation = await PromotionPresentation.create({
      periodeId: periode.id,
      grade,
      ...pickDates(req.body),
      isOpen: isOpen === true,
    })

    return res.status(201).json({ message: 'Presentation added', presentation })
  } catch (error) {
    console.error('Create presentation error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const updatePresentation = async (req, res) => {
  try {
    const presentation = await PromotionPresentation.findByPk(req.params.id)
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found' })
    }

    const dateError = validateDates(req.body)
    if (dateError) {
      return res.status(400).json({ message: dateError })
    }

    const pastError = validateStartDates(req.body, presentation)
    if (pastError) {
      return res.status(400).json({ message: pastError })
    }

    if (req.body.isOpen === true && req.body.submissionEnd < todayString()) {
      return res.status(400).json({
        message: 'The submission end date has passed. Extend it before opening submission.',
      })
    }

    await presentation.update({
      ...pickDates(req.body),
      isOpen: req.body.isOpen === true,
    })

    return res.status(200).json({ message: 'Presentation updated', presentation })
  } catch (error) {
    console.error('Update presentation error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
