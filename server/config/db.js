import { Sequelize } from 'sequelize'

const [host, instanceName] = process.env.HOST_PROMOTION.split('\\')

const sequelize = new Sequelize(
  process.env.DB_PROMOTION,
  process.env.USERNAME_PROMOTION,
  process.env.PASSWORD_PROMOTION,
  {
    host,
    dialect: process.env.HOST_DIALEG || 'mssql',
    logging: false,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        ...(instanceName ? { instanceName } : {}),
      },
    },
  }
)

export default sequelize
