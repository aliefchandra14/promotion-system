import { Router } from 'express'
import { login, logout, me, changePassword } from '../controllers/authController.js'
import verifyToken from '../middleware/verifyToken.js'

const router = Router()

router.post('/login', login)
router.post('/change-password', changePassword)
router.post('/logout', logout)
router.get('/me', verifyToken, me)

export default router
