import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import {
  getMyJudgingList,
  getJudgingPendingCount,
  getAssessmentForm,
  getMyTaskList,
  getTaskReviewForm,
  submitTaskReview,
  submitAssessment,
} from '../controllers/judgingController.js'

const router = Router()

router.get('/', verifyToken, getMyJudgingList)
router.get('/pending-count', verifyToken, getJudgingPendingCount)
router.get('/tasks', verifyToken, getMyTaskList)
router.get('/:employeeId/task', verifyToken, getTaskReviewForm)
router.post('/:employeeId/task', verifyToken, submitTaskReview)
router.get('/:employeeId/assessment', verifyToken, getAssessmentForm)
router.post('/:employeeId/assessment', verifyToken, submitAssessment)

export default router
