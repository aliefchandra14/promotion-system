import { Router } from 'express'
import {
  getEmployees,
  importEmployees,
  updateEmployee,
  getEmployeeJudges,
  addEmployeeJudge,
  removeEmployeeJudge,
} from '../controllers/employeeController.js'
import verifyToken from '../middleware/verifyToken.js'
import requireAdmin from '../middleware/requireAdmin.js'
import upload from '../middleware/upload.js'

const router = Router()

router.get('/', verifyToken, getEmployees)
router.post('/import', verifyToken, requireAdmin, upload.single('file'), importEmployees)

router.patch('/:employeeId', verifyToken, requireAdmin, updateEmployee)
router.get('/:employeeId/judges', verifyToken, requireAdmin, getEmployeeJudges)
router.post('/:employeeId/judges', verifyToken, requireAdmin, addEmployeeJudge)
router.delete('/:employeeId/judges/:judgeId', verifyToken, requireAdmin, removeEmployeeJudge)

export default router
