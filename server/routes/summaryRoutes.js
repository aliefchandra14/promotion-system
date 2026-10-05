import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import upload from '../middleware/upload.js'
import { getSummaries, getMySummaries, addManualSummary } from '../controllers/summaryController.js'
import { downloadSummaryTemplate, uploadSummary } from '../controllers/summaryUploadController.js'

const router = Router()

router.get('/', verifyToken, requireAdmin, getSummaries)
router.get('/me', verifyToken, getMySummaries)
router.post('/manual', verifyToken, requireAdmin, addManualSummary)
router.get('/upload-template', verifyToken, requireAdmin, downloadSummaryTemplate)
router.post('/upload', verifyToken, requireAdmin, upload.single('file'), uploadSummary)

export default router
