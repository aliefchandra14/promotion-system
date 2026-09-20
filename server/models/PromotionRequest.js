import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const PromotionRequest = sequelize.define(
  'PromotionRequest',
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
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending_superior',
    },
    superiorDecision: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    superiorDecidedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    superiorRemark: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    hodDecision: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    hodDecidedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    hodRemark: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    tableName: 'promotion_requests',
    timestamps: true,
    indexes: [{ unique: true, fields: ['employeeId', 'periodeId', 'type'] }],
  }
)

export default PromotionRequest
