import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import {
  getMyPromotions,
  startPromotionRequest,
  getMemberRequests,
  decideRequest,
  getJudgingAssignments,
  getEligibilityMonitor,
  bulkEligibilityAction,
} from '../controllers/promotionController.js'

const router = Router()

router.get('/me', verifyToken, getMyPromotions)
router.post('/start', verifyToken, startPromotionRequest)
router.get('/members', verifyToken, getMemberRequests)
router.post('/:id/decision', verifyToken, decideRequest)
router.get('/judging', verifyToken, getJudgingAssignments)
router.get('/eligibility-monitor', verifyToken, requireAdmin, getEligibilityMonitor)
router.post('/eligibility-monitor/bulk-action', verifyToken, requireAdmin, bulkEligibilityAction)

export default router
