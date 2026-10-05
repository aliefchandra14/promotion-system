import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import { uploadTaskFile } from '../middleware/uploadProject.js'
import {
  getMyTask,
  requireTaskAccess,
  saveTaskFile,
  deleteTaskFile,
  downloadTaskFile,
  submitTask,
} from '../controllers/taskSubmissionController.js'

const router = Router()

router.get('/', verifyToken, getMyTask)
router.post('/files', verifyToken, requireTaskAccess, uploadTaskFile, saveTaskFile)
router.get('/files/:id/download', verifyToken, downloadTaskFile)
router.delete('/files/:id', verifyToken, deleteTaskFile)
router.post('/submit', verifyToken, submitTask)

export default router
