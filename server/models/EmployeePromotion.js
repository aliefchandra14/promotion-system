import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const EmployeePromotion = sequelize.define(
  'EmployeePromotion',
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
    periodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    currentGrade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    promoteGrade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    presentation: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'NO',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'NORMAL',
    },
    remark: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: '',
    },
  },
  {
    tableName: 'employee_promotions',
    timestamps: true,
    indexes: [{ unique: true, fields: ['employeeId', 'periodeId'] }],
  }
)

export default EmployeePromotion
