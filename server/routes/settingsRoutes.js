import { Router } from 'express'
import {
  getMaintenanceStatus,
  updateMaintenanceStatus,
  getAppModeSetting,
  updateAppModeSetting,
} from '../controllers/settingsController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.get('/maintenance', getMaintenanceStatus)
router.patch('/maintenance', verifyToken, requireAdmin, updateMaintenanceStatus)
router.get('/app-mode', verifyToken, getAppModeSetting)
router.patch('/app-mode', verifyToken, requireAdmin, updateAppModeSetting)

export default router
