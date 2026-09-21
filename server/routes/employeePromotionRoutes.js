import { Router } from 'express'
import {
  getEmployeePromotions,
  importEmployeePromotions,
  downloadEmployeePromotionTemplate,
  updateEmployeePromotion,
} from '../controllers/employeePromotionController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import upload from '../middleware/upload.js'

const router = Router()

router.get('/', verifyToken, requireAdmin, getEmployeePromotions)
router.get('/import-template', verifyToken, requireAdmin, downloadEmployeePromotionTemplate)
router.post('/import', verifyToken, requireAdmin, upload.single('file'), importEmployeePromotions)
router.patch('/:id', verifyToken, requireAdmin, updateEmployeePromotion)

export default router
