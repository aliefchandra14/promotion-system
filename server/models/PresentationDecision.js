import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// Admin's final decision for a presenting employee, made after every judge has assessed them.
// For "recommended_with_task" the comment is the task list the employee has to submit.
const PresentationDecision = sequelize.define(
  'PresentationDecision',
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
    employeeId: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // recommended | recommended_with_task | not_recommended | pending_6_month
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    decidedBy: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // When the employee submitted their task files (recommended_with_task only).
    taskSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'presentation_decisions',
    timestamps: true,
    indexes: [{ unique: true, fields: ['periodeId', 'employeeId'] }],
  }
)

export default PresentationDecision
