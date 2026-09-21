import { Router } from 'express'
import { getMaintenanceStatus, updateMaintenanceStatus } from '../controllers/settingsController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.get('/maintenance', getMaintenanceStatus)
router.patch('/maintenance', verifyToken, requireAdmin, updateMaintenanceStatus)

export default router
