import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import {
  getMyPromotions,
  startPromotionRequest,
  getMemberRequests,
  decideRequest,
  getJudgingAssignments,
} from '../controllers/promotionController.js'

const router = Router()

router.get('/me', verifyToken, getMyPromotions)
router.post('/start', verifyToken, startPromotionRequest)
router.get('/members', verifyToken, getMemberRequests)
router.post('/:id/decision', verifyToken, decideRequest)
router.get('/judging', verifyToken, getJudgingAssignments)

export default router
