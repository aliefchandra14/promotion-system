import { Router } from 'express'
import { getSummary } from '../controllers/dashboardController.js'
import verifyToken from '../middleware/verifyToken.js'

const router = Router()

router.get('/summary', verifyToken, getSummary)

export default router
