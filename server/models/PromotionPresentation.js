import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One row per (period, grade): the schedule and open/closed switch for the project
// briefing, submission and presentation of employees being promoted to that grade.
const PromotionPresentation = sequelize.define(
  'PromotionPresentation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    periodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    grade: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    briefingStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    briefingEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    submissionStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    submissionEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    presentationStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    presentationEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    // When true, employees promoted to this grade are allowed to submit.
    isOpen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'promotion_presentations',
    timestamps: true,
    indexes: [{ unique: true, fields: ['periodeId', 'grade'] }],
  }
)

export default PromotionPresentation
