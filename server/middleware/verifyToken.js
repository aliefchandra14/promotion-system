import jwt from 'jsonwebtoken'
import { Setting } from '../models/index.js'

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ message: 'You are not logged in' })
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)

    if (req.user.role !== 'admin') {
      const settings = await Setting.findByPk(1)
      if (settings?.maintenanceMode) {
        return res.status(503).json({
          message:
            settings.maintenanceMessage ||
            'The system is currently under maintenance. Please try again later.',
        })
      }
    }

    next()
  } catch (error) {
    return res.status(401).json({ message: 'Session expired, please log in again' })
  }
}

export default verifyToken
