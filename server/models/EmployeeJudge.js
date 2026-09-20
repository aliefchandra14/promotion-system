import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const EmployeeJudge = sequelize.define(
  'EmployeeJudge',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employeeId: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    judgeId: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
  },
  {
    tableName: 'employee_judges',
    timestamps: true,
    indexes: [{ unique: true, fields: ['employeeId', 'judgeId'] }],
  }
)

export default EmployeeJudge
