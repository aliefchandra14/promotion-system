import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// Admin's final approve/reject of an employee's task, after every judge reviewed it.
// Approve turns the result into "recommended", reject into "not_recommended".
const TaskDecision = sequelize.define(
  'TaskDecision',
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
    // approve | reject
    decision: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    comment: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    decidedBy: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: 'task_decisions',
    timestamps: true,
    indexes: [{ unique: true, fields: ['periodeId', 'employeeId'] }],
  }
)

export default TaskDecision
