import './config/env.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import compression from 'compression'
import { connectDB } from './models/index.js'
import { ensureFiscalYearPeriods } from './services/periodeService.js'
import authRoutes from './routes/authRoutes.js'
import employeeRoutes from './routes/employeeRoutes.js'
import periodeRoutes from './routes/periodeRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import promotionRoutes from './routes/promotionRoutes.js'
import employeePromotionRoutes from './routes/employeePromotionRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import summaryRoutes from './routes/summaryRoutes.js'
import presentationRoutes from './routes/presentationRoutes.js'
import projectSubmissionRoutes from './routes/projectSubmissionRoutes.js'
import judgingRoutes from './routes/judgingRoutes.js'
import taskSubmissionRoutes from './routes/taskSubmissionRoutes.js'

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(compression())
app.use(cookieParser())
app.use(express.json())

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

app.use('/api/auth', authRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/periodes', periodeRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/promotions', promotionRoutes)
app.use('/api/employee-promotions', employeePromotionRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/summaries', summaryRoutes)
app.use('/api/presentations', presentationRoutes)
app.use('/api/project-submission', projectSubmissionRoutes)
app.use('/api/judging', judgingRoutes)
app.use('/api/task-submission', taskSubmissionRoutes)

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' })
})

app.use((err, req, res, next) => {
  if (!err) return next()
  console.error('Unhandled error:', err)
  return res.status(400).json({ message: err.message || 'Something went wrong' })
})

const PORT = process.env.PORT || 5000

connectDB().then(async () => {
  // The current fiscal year always has its Periode 1 & 2 (created here if missing).
  await ensureFiscalYearPeriods()
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
})
