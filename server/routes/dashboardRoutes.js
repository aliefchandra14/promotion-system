import { Router } from 'express'
import { getSummary, getPromotionStats } from '../controllers/dashboardController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.get('/summary', verifyToken, getSummary)
router.get('/promotion-stats', verifyToken, requireAdmin, getPromotionStats)

export default router
