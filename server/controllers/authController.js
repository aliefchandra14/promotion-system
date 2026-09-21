import jwt from 'jsonwebtoken'
import { Op } from 'sequelize'
import { Employee, Periode, EmployeeJudge, Setting } from '../models/index.js'

const signToken = (employee) =>
  jwt.sign(
    { id: employee.id, employeeId: employee.employeeId, role: employee.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  )

const buildUserPayload = async (employee) => {
  const [subordinateCount, judgeCount] = await Promise.all([
    Employee.count({
      where: { [Op.or]: [{ superior: employee.employeeId }, { hod: employee.employeeId }] },
    }),
    EmployeeJudge.count({ where: { judgeId: employee.employeeId } }),
  ])

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    grade: employee.grade,
    isSuperiorOrHod: subordinateCount > 0,
    isJudge: judgeCount > 0,
  }
}

export const login = async (req, res) => {
  try {
    const { employeeId, password } = req.body

    if (!employeeId || !password) {
      return res.status(400).json({ message: 'Employee ID and password are required' })
    }

    const employee = await Employee.findOne({ where: { employeeId } })

    if (!employee || !employee.isActive || employee.password !== password) {
      return res.status(401).json({ message: 'Invalid employee ID or password' })
    }

    if (employee.role !== 'admin') {
      const settings = await Setting.findByPk(1)
      if (settings?.maintenanceMode) {
        return res.status(503).json({
          message:
            settings.maintenanceMessage ||
            'The system is currently under maintenance. Please try again later.',
        })
      }

      const activePeriode = await Periode.findOne({ where: { status: 'active' } })
      if (!activePeriode) {
        return res.status(403).json({
          message: 'No active promotion period yet. Please wait until it is activated.',
        })
      }
    }

    if (!employee.isChange) {
      return res.status(200).json({
        requireChangePassword: true,
        employeeId: employee.employeeId,
        message: 'Please change your password first',
      })
    }

    const token = signToken(employee)

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })

    return res.status(200).json({
      message: 'Login successful',
      user: await buildUserPayload(employee),
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const changePassword = async (req, res) => {
  try {
    const { employeeId, oldPassword, newPassword, confirmPassword } = req.body

    if (!employeeId || !oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Password confirmation does not match' })
    }

    const employee = await Employee.findOne({ where: { employeeId } })

    if (!employee || !employee.isActive || employee.password !== oldPassword) {
      return res.status(401).json({ message: 'Invalid employee ID or old password' })
    }

    employee.password = newPassword
    employee.isChange = 1
    await employee.save()

    return res.status(200).json({ message: 'Password changed successfully, please log in again' })
  } catch (error) {
    console.error('Change password error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

export const logout = (req, res) => {
  res.clearCookie('token')
  return res.status(200).json({ message: 'Logout successful' })
}

export const me = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    })

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' })
    }

    return res.status(200).json({ user: await buildUserPayload(employee) })
  } catch (error) {
    console.error('Me error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}
