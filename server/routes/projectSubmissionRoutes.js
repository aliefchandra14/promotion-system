import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import { uploadProjectFile } from '../middleware/uploadProject.js'
import {
  getProjectSubmission,
  requireSubmissionAccess,
  saveProjectFile,
  deleteProjectFile,
  downloadProjectFile,
} from '../controllers/projectSubmissionController.js'

const router = Router()

router.get('/', verifyToken, getProjectSubmission)
router.post('/files', verifyToken, requireSubmissionAccess, uploadProjectFile, saveProjectFile)
router.get('/files/:id/download', verifyToken, downloadProjectFile)
router.delete('/files/:id', verifyToken, deleteProjectFile)

export default router
