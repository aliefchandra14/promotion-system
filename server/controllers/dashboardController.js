import { Employee, EmployeePromotion, Periode, PromotionSummary } from '../models/index.js'
import { getCurrentFiscalYear } from '../constants/fiscalYear.js'

export const getSummary = async (req, res) => {
  try {
    const [totalEmployees, totalActiveEmployees, totalPeriodes, totalActivePeriodes] =
      await Promise.all([
        Employee.count(),
        Employee.count({ where: { isActive: true } }),
        Periode.count(),
        Periode.count({ where: { status: 'active' } }),
      ])

    return res.status(200).json({
      totalEmployees,
      totalActiveEmployees,
      totalPeriodes,
      totalActivePeriodes,
    })
  } catch (error) {
    console.error('Get dashboard summary error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

const PASSED_STATUSES = ['Recommended', 'OK']

const emptyOutcome = () => ({ withPresentation: 0, withoutPresentation: 0, delayed: 0, failed: 0 })

/**
 * Promotion figures for one fiscal year (default: the current one).
 *
 * - input: employees in the promotion process per path (NORMAL / SPECIAL / PTC), counted once
 *   per FY even when they appear in both periods (e.g. carried over after "Pending 6 Month").
 * - output1 (NORMAL path) and output2 (SPECIAL path), from the summary: passed with presentation,
 *   passed without presentation, delayed (Pending 6 Month) and not passed (Not Recommended);
 *   output1 also counts the PTC path (manual entries, always passed).
 * - completion: (output1 + output2) / input.
 */
export const getPromotionStats = async (req, res) => {
  try {
    const periodes = await Periode.findAll({ attributes: ['id', 'fiscalYear'], raw: true })
    const fiscalYears = [...new Set([getCurrentFiscalYear(), ...periodes.map((p) => p.fiscalYear)])].sort(
      (a, b) => b - a
    )

    const requested = parseInt(req.query.fiscalYear, 10)
    const fiscalYear = fiscalYears.includes(requested) ? requested : getCurrentFiscalYear()
    const periodeIds = periodes.filter((p) => p.fiscalYear === fiscalYear).map((p) => p.id)

    const [promotions, summaries] = await Promise.all([
      periodeIds.length
        ? EmployeePromotion.findAll({
            where: { periodeId: periodeIds },
            attributes: ['employeeId', 'type'],
            raw: true,
          })
        : [],
      PromotionSummary.findAll({
        where: { fiscalYear },
        attributes: ['type', 'presentation', 'status'],
        raw: true,
      }),
    ])

    const inputSets = { NORMAL: new Set(), SPECIAL: new Set(), PTC: new Set() }
    for (const promotion of promotions) {
      const type = String(promotion.type || '').toUpperCase()
      if (inputSets[type]) inputSets[type].add(promotion.employeeId)
    }
    const input = {
      normal: inputSets.NORMAL.size,
      special: inputSets.SPECIAL.size,
      ptc: inputSets.PTC.size,
    }
    input.total = input.normal + input.special + input.ptc

    const output1 = { ...emptyOutcome(), ptc: 0 }
    const output2 = emptyOutcome()
    for (const summary of summaries) {
      const type = String(summary.type || '').toUpperCase()
      if (type === 'PTC') {
        output1.ptc += 1
        continue
      }
      const target = type === 'NORMAL' ? output1 : type === 'SPECIAL' ? output2 : null
      if (!target) continue

      if (PASSED_STATUSES.includes(summary.status)) {
        if (summary.presentation === 'YES') target.withPresentation += 1
        else target.withoutPresentation += 1
      } else if (summary.status === 'Pending 6 Month') {
        target.delayed += 1
      } else if (summary.status === 'Not Recommended') {
        target.failed += 1
      }
    }
    output1.total =
      output1.withPresentation + output1.withoutPresentation + output1.ptc + output1.delayed + output1.failed
    output2.total = output2.withPresentation + output2.withoutPresentation + output2.delayed + output2.failed

    const processed = output1.total + output2.total
    return res.status(200).json({
      fiscalYear,
      fiscalYears,
      input,
      output1,
      output2,
      completion: {
        processed,
        input: input.total,
        rate: input.total ? Math.round((processed / input.total) * 1000) / 10 : null,
      },
    })
  } catch (error) {
    console.error('Get promotion stats error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
