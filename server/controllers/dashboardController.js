import { Employee, Periode } from '../models/index.js'

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
