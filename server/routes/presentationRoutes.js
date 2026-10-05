import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import {
  getPresentations,
  createPresentation,
  updatePresentation,
  getPresentationCandidates,
  addCandidateJudge,
  removeCandidateJudge,
  replaceCandidateJudge,
  getCandidateAssessments,
  saveCandidateDecision,
  saveCandidateTaskDecision,
} from '../controllers/presentationController.js'
import {
  getReminderPreview,
  sendPresentationReminder,
} from '../controllers/presentationReminderController.js'

const router = Router()

router.get('/', verifyToken, requireAdmin, getPresentations)
router.post('/', verifyToken, requireAdmin, createPresentation)
router.patch('/:id', verifyToken, requireAdmin, updatePresentation)
router.get('/:id/candidates', verifyToken, requireAdmin, getPresentationCandidates)
router.post('/:id/candidates/:employeeId/judges', verifyToken, requireAdmin, addCandidateJudge)
router.delete('/:id/candidates/:employeeId/judges/:judgeId', verifyToken, requireAdmin, removeCandidateJudge)
router.put('/:id/candidates/:employeeId/judges/:judgeId', verifyToken, requireAdmin, replaceCandidateJudge)
router.get('/:id/candidates/:employeeId/assessments', verifyToken, requireAdmin, getCandidateAssessments)
router.put('/:id/candidates/:employeeId/decision', verifyToken, requireAdmin, saveCandidateDecision)
router.put('/:id/candidates/:employeeId/task-decision', verifyToken, requireAdmin, saveCandidateTaskDecision)
router.get('/:id/reminders/:type/preview', verifyToken, requireAdmin, getReminderPreview)
router.post('/:id/reminders/:type', verifyToken, requireAdmin, sendPresentationReminder)

export default router
