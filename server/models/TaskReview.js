import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One judge's approve/reject of an employee's submitted task. Final once submitted.
const TaskReview = sequelize.define(
  'TaskReview',
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
    judgeId: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // Snapshot, so the history keeps the name even if the employee record changes later.
    judgeName: {
      type: DataTypes.STRING(100),
      allowNull: true,
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
  },
  {
    tableName: 'task_reviews',
    timestamps: true,
    indexes: [{ unique: true, fields: ['periodeId', 'employeeId', 'judgeId'] }],
  }
)

export default TaskReview
