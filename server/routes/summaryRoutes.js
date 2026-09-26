import { Router } from 'express'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import { getSummaries } from '../controllers/summaryController.js'

const router = Router()

router.get('/', verifyToken, requireAdmin, getSummaries)

export default router
