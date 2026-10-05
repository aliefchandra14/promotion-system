import { PromotionSummary } from '../models/index.js'
import { getCurrentFiscalYear } from '../constants/fiscalYear.js'

export const SUMMARY_STATUS_OK = 'OK'

/**
 * Puts a promotion candidate into the summary (or refreshes their row if already there)
 * and flags their promotion record as summarized.
 *
 * - periode: title of the active period (snapshot)
 * - FY: the fiscal year of the period (April - March), e.g. 2026 -> "FY2026"
 * - status: "OK", or the presentation result when given (e.g. "Recommended")
 * - remark: the promotion remark, or the given remark
 *
 * Pass `transaction` to make it atomic with the caller's other writes.
 */
export const addToSummary = async ({ promotion, periode, status, remark, transaction }) => {
  const snapshot = {
    name: promotion.name,
    department: promotion.department,
    currentGrade: promotion.currentGrade,
    promoteGrade: promotion.promoteGrade,
    fiscalYear: periode.fiscalYear ?? getCurrentFiscalYear(),
    periodeName: periode.name,
    type: promotion.type,
    presentation: promotion.presentation,
    status: status || SUMMARY_STATUS_OK,
    remark: remark ?? (promotion.remark || ''),
  }

  const [summary, created] = await PromotionSummary.findOrCreate({
    where: { employeeId: promotion.employeeId, periodeId: periode.id },
    defaults: snapshot,
    transaction,
  })

  if (!created) {
    await summary.update(snapshot, { transaction })
  }

  if (promotion.adminDecision !== 'summarized') {
    await promotion.update({ adminDecision: 'summarized' }, { transaction })
  }

  return { summary, created }
}
