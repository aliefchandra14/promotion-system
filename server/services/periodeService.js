import { Op } from 'sequelize'
import { Employee, EmployeePromotion, Periode, PromotionRequest } from '../models/index.js'
import { getCurrentFiscalYear, getFiscalYearLabel } from '../constants/fiscalYear.js'

// Every fiscal year (April - March) has exactly these two periods; they are created automatically
// and cannot be added or deleted by hand. Admin can only change their dates and (de)activate them.
export const PERIOD_NAMES = ['Periode 1', 'Periode 2']

// Default dates: Periode 1 = first half of the FY (Apr - Sep), Periode 2 = second half (Oct - Mar).
const defaultDates = (fiscalYear, index) =>
  index === 0
    ? { startDate: `${fiscalYear}-04-01`, endDate: `${fiscalYear}-09-30` }
    : { startDate: `${fiscalYear}-10-01`, endDate: `${fiscalYear + 1}-03-31` }

// Makes sure the fiscal year has its two periods. Existing ones (matched by name) are kept as they are.
export const ensureFiscalYearPeriods = async (fiscalYear = getCurrentFiscalYear()) => {
  for (const [index, name] of PERIOD_NAMES.entries()) {
    await Periode.findOrCreate({
      where: { fiscalYear, name },
      defaults: { ...defaultDates(fiscalYear, index), status: 'draft' },
    })
  }
}

// The period six months later: Periode 1 -> Periode 2 of the same FY, Periode 2 -> Periode 1 of the next FY.
export const getNextPeriode = async (periode) => {
  const isFirst = periode.name === PERIOD_NAMES[0]
  const fiscalYear = isFirst ? periode.fiscalYear : periode.fiscalYear + 1
  await ensureFiscalYearPeriods(fiscalYear)
  return Periode.findOne({ where: { fiscalYear, name: isFirst ? PERIOD_NAMES[1] : PERIOD_NAMES[0] } })
}

// Marks promotion records created by a carry-over, so an undo removes only those.
const carryOverRemark = (periode) => `Pending 6 Month from ${periode.name} ${getFiscalYearLabel(periode.fiscalYear)}`

/**
 * "Pending 6 Month": the employee presents again in the next period. They skip the eligibility
 * approval there and are eligible for submission straight away (the same judges stay assigned).
 * Uses the promotion record of the next period if admin already imported one, otherwise copies it.
 */
export const carryOverPending = async ({ promotion, periode, transaction }) => {
  const next = await getNextPeriode(periode)

  const existing = await EmployeePromotion.findOne({
    where: { employeeId: promotion.employeeId, periodeId: next.id },
    transaction,
  })
  if (existing) {
    await existing.update({ adminDecision: 'eligible_for_submission' }, { transaction })
  } else {
    await EmployeePromotion.create(
      {
        employeeId: promotion.employeeId,
        periodeId: next.id,
        name: promotion.name,
        department: promotion.department,
        currentGrade: promotion.currentGrade,
        promoteGrade: promotion.promoteGrade,
        type: promotion.type,
        toeic: promotion.toeic,
        presentation: promotion.presentation,
        status: promotion.status,
        remark: carryOverRemark(periode),
        adminDecision: 'eligible_for_submission',
      },
      { transaction }
    )
  }

  // No eligibility approval in the next period: drop one that is still waiting (e.g. from an import).
  await PromotionRequest.destroy({
    where: {
      employeeId: promotion.employeeId,
      periodeId: next.id,
      type: 'eligibility',
      status: { [Op.in]: ['pending_superior', 'pending_hod'] },
    },
    transaction,
  })

  return next
}

// Undo of carryOverPending when admin changes a "Pending 6 Month" decision, as long as the employee
// has not started their submission in the next period yet. Returns false when it is too late.
export const undoCarryOver = async ({ promotion, periode, transaction }) => {
  const next = await getNextPeriode(periode)
  const record = await EmployeePromotion.findOne({
    where: { employeeId: promotion.employeeId, periodeId: next.id },
    transaction,
  })
  if (!record) return true

  const started = await PromotionRequest.count({
    where: { employeeId: promotion.employeeId, periodeId: next.id, type: 'submission' },
    transaction,
  })
  if (started > 0) return false

  if (record.remark === carryOverRemark(periode)) {
    await record.destroy({ transaction })
    return true
  }

  // The record was imported by admin: put it back through the normal eligibility approval.
  await record.update({ adminDecision: 'pending' }, { transaction })
  const employee = await Employee.findOne({
    where: { employeeId: promotion.employeeId },
    attributes: ['superior'],
    transaction,
  })
  if (employee?.superior) {
    await PromotionRequest.findOrCreate({
      where: { employeeId: promotion.employeeId, periodeId: next.id, type: 'eligibility' },
      defaults: { status: 'pending_superior' },
      transaction,
    })
  }
  return true
}
