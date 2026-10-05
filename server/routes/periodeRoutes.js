import { Router } from 'express'
import {
  getPeriodes,
  updatePeriodeDates,
  activatePeriode,
  deactivatePeriode,
  sendPeriodReminder,
} from '../controllers/periodeController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

// Periods are fixed (Periode 1 & 2 per fiscal year, created automatically): no create/delete.
router.get('/', verifyToken, getPeriodes)
router.patch('/:id', verifyToken, requireAdmin, updatePeriodeDates)
router.patch('/:id/activate', verifyToken, requireAdmin, activatePeriode)
router.patch('/:id/deactivate', verifyToken, requireAdmin, deactivatePeriode)
router.post('/:id/send-reminder', verifyToken, requireAdmin, sendPeriodReminder)

export default router
