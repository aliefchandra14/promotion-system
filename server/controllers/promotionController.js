import { Employee, Periode, PromotionRequest, EmployeeJudge } from '../models/index.js'

const TYPES = ['eligibility', 'submission']

export const getMyPromotions = async (req, res) => {
  try {
    const activePeriode = await Periode.findOne({ where: { status: 'active' } })

    if (!activePeriode) {
      return res.status(200).json({ periode: null, requests: [] })
    }

    const requests = await PromotionRequest.findAll({
      where: { employeeId: req.user.employeeId, periodeId: activePeriode.id },
    })

    return res.status(200).json({ periode: activePeriode, requests })
  } catch (error) {
    console.error('Get my promotions error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const startPromotionRequest = async (req, res) => {
  try {
    const { type } = req.body

    if (!TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid request type' })
    }

    const activePeriode = await Periode.findOne({ where: { status: 'active' } })
    if (!activePeriode) {
      return res.status(400).json({ message: 'No active promotion period' })
    }

    const employee = await Employee.findOne({ where: { employeeId: req.user.employeeId } })
    if (!employee?.superior) {
      return res.status(400).json({ message: 'You do not have a superior assigned yet, contact admin' })
    }

    const [request, created] = await PromotionRequest.findOrCreate({
      where: { employeeId: employee.employeeId, periodeId: activePeriode.id, type },
      defaults: { status: 'pending_superior' },
    })

    if (!created) {
      return res.status(409).json({ message: 'A request already exists for this period', request })
    }

    return res.status(201).json({ message: 'Request submitted', request })
  } catch (error) {
    console.error('Start promotion request error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const getMemberRequests = async (req, res) => {
  try {
    const { type, stage } = req.query

    if (!TYPES.includes(type) || !['superior', 'hod'].includes(stage)) {
      return res.status(400).json({ message: 'Invalid query parameters' })
    }

    const me = req.user.employeeId
    const statusFilter = stage === 'superior' ? 'pending_superior' : 'pending_hod'
    const relationField = stage === 'superior' ? 'superior' : 'hod'

    const members = await Employee.findAll({
      where: { [relationField]: me },
      attributes: ['employeeId'],
      raw: true,
    })
    const memberIds = members.map((member) => member.employeeId)

    if (memberIds.length === 0) {
      return res.status(200).json({ requests: [] })
    }

    const activePeriode = await Periode.findOne({ where: { status: 'active' } })
    if (!activePeriode) {
      return res.status(200).json({ requests: [] })
    }

    const requests = await PromotionRequest.findAll({
      where: {
        employeeId: memberIds,
        periodeId: activePeriode.id,
        type,
        status: statusFilter,
      },
      include: [{ model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'department', 'grade'] }],
      order: [['createdAt', 'ASC']],
    })

    return res.status(200).json({ requests })
  } catch (error) {
    console.error('Get member requests error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const decideRequest = async (req, res) => {
  try {
    const { id } = req.params
    const { decision, remark } = req.body

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject' })
    }

    const request = await PromotionRequest.findByPk(id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }

    const employee = await Employee.findOne({ where: { employeeId: request.employeeId } })
    const me = req.user.employeeId

    if (request.status === 'pending_superior') {
      if (employee?.superior !== me) {
        return res.status(403).json({ message: 'You are not the superior for this employee' })
      }
      request.superiorDecision = decision
      request.superiorDecidedAt = new Date()
      request.superiorRemark = remark || null
      request.status = decision === 'approve' ? 'pending_hod' : 'rejected'
    } else if (request.status === 'pending_hod') {
      if (employee?.hod !== me) {
        return res.status(403).json({ message: 'You are not the HOD for this employee' })
      }
      request.hodDecision = decision
      request.hodDecidedAt = new Date()
      request.hodRemark = remark || null
      request.status = decision === 'approve' ? 'approved' : 'rejected'
    } else {
      return res.status(400).json({ message: 'This request has already been finalized' })
    }

    await request.save()

    return res.status(200).json({ message: 'Decision recorded', request })
  } catch (error) {
    console.error('Decide request error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const getJudgingAssignments = async (req, res) => {
  try {
    const judgeId = req.user.employeeId
    const links = await EmployeeJudge.findAll({ where: { judgeId } })
    const employeeIds = links.map((link) => link.employeeId)

    const employees = employeeIds.length
      ? await Employee.findAll({
          where: { employeeId: employeeIds },
          attributes: ['employeeId', 'name', 'department', 'grade'],
        })
      : []

    return res.status(200).json({ employees })
  } catch (error) {
    console.error('Get judging assignments error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
