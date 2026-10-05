import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One uploaded task file (for "Recommended with Task"). The file itself lives on disk (storedName).
const TaskSubmissionFile = sequelize.define(
  'TaskSubmissionFile',
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
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    storedName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'task_submission_files',
    timestamps: true,
  }
)

export default TaskSubmissionFile
