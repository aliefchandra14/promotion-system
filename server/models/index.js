import sequelize from '../config/db.js'
import Employee from './Employee.js'
import Periode from './Periode.js'
import EmployeeJudge from './EmployeeJudge.js'
import PromotionRequest from './PromotionRequest.js'
import EmployeePromotion from './EmployeePromotion.js'
import Setting from './Setting.js'
import PromotionSummary from './PromotionSummary.js'
import PromotionPresentation from './PromotionPresentation.js'
import ProjectSubmissionFile from './ProjectSubmissionFile.js'
import PresentationReminderLog from './PresentationReminderLog.js'

Employee.belongsTo(Employee, {
  foreignKey: 'trainer',
  targetKey: 'employeeId',
  as: 'trainerInfo',
  constraints: false,
})
Employee.belongsTo(Employee, {
  foreignKey: 'superior',
  targetKey: 'employeeId',
  as: 'superiorInfo',
  constraints: false,
})
Employee.belongsTo(Employee, {
  foreignKey: 'hod',
  targetKey: 'employeeId',
  as: 'hodInfo',
  constraints: false,
})

EmployeeJudge.belongsTo(Employee, {
  foreignKey: 'employeeId',
  targetKey: 'employeeId',
  as: 'employee',
  constraints: false,
})
EmployeeJudge.belongsTo(Employee, {
  foreignKey: 'judgeId',
  targetKey: 'employeeId',
  as: 'judge',
  constraints: false,
})

PromotionRequest.belongsTo(Employee, {
  foreignKey: 'employeeId',
  targetKey: 'employeeId',
  as: 'employee',
  constraints: false,
})
PromotionRequest.belongsTo(Periode, {
  foreignKey: 'periodeId',
  targetKey: 'id',
  as: 'periode',
  constraints: false,
})

EmployeePromotion.belongsTo(Employee, {
  foreignKey: 'employeeId',
  targetKey: 'employeeId',
  as: 'employee',
  constraints: false,
})
EmployeePromotion.belongsTo(Periode, {
  foreignKey: 'periodeId',
  targetKey: 'id',
  as: 'periode',
  constraints: false,
})

const ADMIN_EMPLOYEE_ID = process.env.ADMIN_EMPLOYEE_ID || '102938'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Gmp#b#0099'

const seedAdmin = async () => {
  const [, created] = await Employee.findOrCreate({
    where: { employeeId: ADMIN_EMPLOYEE_ID },
    defaults: {
      name: 'Administrator',
      password: ADMIN_PASSWORD,
      role: 'admin',
      isChange: 1,
    },
  })

  if (created) {
    console.log(`Default admin account created -> employeeId: ${ADMIN_EMPLOYEE_ID}`)
  }
}

const seedSettings = async () => {
  await Setting.findOrCreate({ where: { id: 1 }, defaults: { maintenanceMode: false } })
}

const connectDB = async () => {
  try {
    await sequelize.authenticate()
    console.log('MSSQL database connection successful')
    await sequelize.sync()
    await seedAdmin()
    await seedSettings()
  } catch (error) {
    console.error('Failed to connect to database:', error.message)
    process.exit(1)
  }
}

export {
  sequelize,
  Employee,
  Periode,
  EmployeeJudge,
  PromotionRequest,
  EmployeePromotion,
  PromotionSummary,
  PromotionPresentation,
  ProjectSubmissionFile,
  PresentationReminderLog,
  Setting,
  connectDB,
}
