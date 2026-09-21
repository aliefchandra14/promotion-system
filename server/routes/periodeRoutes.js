import { Router } from 'express'
import {
  getPeriodes,
  createPeriode,
  activatePeriode,
  deactivatePeriode,
  deletePeriode,
  sendPeriodReminder,
} from '../controllers/periodeController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.get('/', verifyToken, getPeriodes)
router.post('/', verifyToken, requireAdmin, createPeriode)
router.patch('/:id/activate', verifyToken, requireAdmin, activatePeriode)
router.patch('/:id/deactivate', verifyToken, requireAdmin, deactivatePeriode)
router.delete('/:id', verifyToken, requireAdmin, deletePeriode)
router.post('/:id/send-reminder', verifyToken, requireAdmin, sendPeriodReminder)

export default router
