import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One judge's assessment of one presenting employee in a period. Final once submitted.
const PresentationAssessment = sequelize.define(
  'PresentationAssessment',
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
    promoteGrade: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // JSON: [{ category, area, question, score }] in the order of the criteria.
    scores: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Sum of the indicator scores scaled to 100.
    assessmentScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // TOEIC used in the final score (only for grades that count TOEIC), null otherwise.
    toeic: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    finalScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // recommended | recommended_with_task | not_recommended | pending_6_month
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    comment: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
  },
  {
    tableName: 'presentation_assessments',
    timestamps: true,
    indexes: [{ unique: true, fields: ['periodeId', 'employeeId', 'judgeId'] }],
  }
)

export default PresentationAssessment
