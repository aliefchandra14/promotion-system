import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One row per event in an employee's project submission: each time they submit, and each
// approve/reject by the superior or HOD. `attempt` groups the events of one submission, since a
// rejected submission can be sent again (the PromotionRequest row itself is reset on resubmit).
const SubmissionHistory = sequelize.define(
  'SubmissionHistory',
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
    attempt: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // submitted | approved | rejected
    event: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // employee | superior | hod | admin
    actorRole: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    actorId: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Snapshot, so the history keeps the name even if the employee record changes later.
    actorName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    remark: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // For "submitted": JSON list of the file names sent with this submission.
    files: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'submission_histories',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['employeeId', 'periodeId'] }],
  }
)

export default SubmissionHistory
