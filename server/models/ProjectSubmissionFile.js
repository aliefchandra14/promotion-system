import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One row per uploaded project file. The file itself lives on disk (storedName),
// this row keeps who uploaded it, for which period, and its display details.
const ProjectSubmissionFile = sequelize.define(
  'ProjectSubmissionFile',
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
    tableName: 'project_submission_files',
    timestamps: true,
  }
)

export default ProjectSubmissionFile
