import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// Snapshot of a promotion candidate at the moment they were moved to the summary,
// so later edits to the employee or promotion record do not rewrite history.
const PromotionSummary = sequelize.define(
  'PromotionSummary',
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
    fiscalYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    periodeName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    presentation: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'OK',
    },
    remark: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: '',
    },
  },
  {
    tableName: 'promotion_summaries',
    timestamps: true,
    indexes: [{ unique: true, fields: ['employeeId', 'periodeId'] }],
  }
)

export default PromotionSummary
