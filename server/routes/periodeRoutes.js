import { Router } from 'express'
import { getPeriodes, createPeriode, activatePeriode } from '../controllers/periodeController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.get('/', verifyToken, getPeriodes)
router.post('/', verifyToken, requireAdmin, createPeriode)
router.patch('/:id/activate', verifyToken, requireAdmin, activatePeriode)

export default router
