import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import {
  getPresentations,
  createPresentation,
  updatePresentation,
} from '../controllers/presentationController.js'
import {
  getReminderPreview,
  sendPresentationReminder,
} from '../controllers/presentationReminderController.js'

const router = Router()

router.get('/', verifyToken, requireAdmin, getPresentations)
router.post('/', verifyToken, requireAdmin, createPresentation)
router.patch('/:id', verifyToken, requireAdmin, updatePresentation)
router.get('/:id/reminders/:type/preview', verifyToken, requireAdmin, getReminderPreview)
router.post('/:id/reminders/:type', verifyToken, requireAdmin, sendPresentationReminder)

export default router
