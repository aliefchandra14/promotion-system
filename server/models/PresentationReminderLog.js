import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

// One row every time an admin sends a briefing / submission / presentation reminder
// for a grade. Lets the admin page show "last sent" and keeps a simple audit trail.
const PresentationReminderLog = sequelize.define(
  'PresentationReminderLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    presentationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    sentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // true when SMTP is not configured yet and the emails were only written to the server log.
    simulated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sentBy: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: 'presentation_reminder_logs',
    timestamps: true,
    indexes: [{ fields: ['presentationId', 'type'] }],
  }
)

export default PresentationReminderLog
